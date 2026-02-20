// /src/components/context/OrdersContext.tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  ReactNode,
} from "react";
import { supabase } from "../../lib/supabase"; // <-- ajuste o caminho se necessário
import { fromApiStatus, toApiStatus, PtStatus } from "../../services/status";
import ErrorPopup from "../ErrorPopup";

/* =========================================================
   Tipos
   ========================================================= */
export type OrderItemUI = {
  name?: string;
  size?: string;
  quantity?: number;
  unitPriceCents?: number;
  subtotalCents?: number;
  category?: string;
};

export type OrderUI = {
  id: number | string;
  orderNumber?: string;
  createdAt?: string;
  name?: string;
  table?: string | number;
  items?: OrderItemUI[];
  totalCents?: number;
  status: PtStatus;
};

type CreateFromCartParams = {
  name: string;
  table: string | number;
  items: Array<{
    productId: string | number;
    name?: string;
    size?: string;
    quantity: number;
    unitPriceCents: number;
  }>;
};

type OrdersContextType = {
  orders: OrderUI[];
  loading: boolean;
  error: string | null;

  refresh: () => Promise<void>;
  createOrderFromCart: (params: CreateFromCartParams) => Promise<OrderUI>;
  updateOrderStatus: (id: number | string, newStatusPt: PtStatus) => Promise<void>;
  updateOrderInfo: (
    id: number | string,
    data: { name?: string; table?: string | number }
  ) => Promise<void>;
  deleteOrder: (id: number | string) => Promise<void>;
};

const OrdersContext = createContext<OrdersContextType | null>(null);

export const useOrders = () => {
  const ctx = useContext(OrdersContext);
  if (!ctx) throw new Error("useOrders must be used within <OrdersProvider>");
  return ctx;
};

/* =========================================================
   DTO -> UI
   ========================================================= */
function formatOrderDTO(dto: any): OrderUI {
  console.log("[OrdersContext] formatOrderDTO() raw dto:", dto);

  const id =
    dto?.order_id ??
    dto?.id ??
    dto?.OrderId ??
    dto?.OrderID ??
    dto?.Order?.id ??
    "";

  const customer = dto?.customer ?? dto?.Customer ?? {};
  const customerName =
    customer?.name ?? dto?.customer_name ?? dto?.name ?? "";
  const table =
    customer?.table_number ??
    customer?.table ??
    dto?.table_number ??
    dto?.table ??
    "";

  // itens do pedido vindos do backend em diversos formatos
  let rawItems: unknown =
    dto?.order_items ??
    dto?.orderItems ??
    dto?.OrderItems ??
    dto?.items ??
    [];

  if (!Array.isArray(rawItems)) rawItems = [];

  const items: OrderItemUI[] = (rawItems as any[]).map((it) => {
    const p = it?.product ?? it?.Product ?? {};
    const name = p?.name ?? it?.product_name ?? it?.name_snapshot ?? it?.name ?? "";
    const category =
      p?.category?.name ??
      p?.Category?.name ??
      it?.category_name ??
      it?.category ??
      "";
    const size = it?.size ?? it?.Size ?? "";
    const unitPriceCents =
      Number(
        it?.unit_price_cents ??
          it?.unitPriceCents ??
          it?.price_cents ??
          Math.round(Number(it?.price ?? 0) * 100)
      ) || 0;
    const quantity = Number(it?.quantity ?? it?.qty ?? 1) || 1;
    const subtotalCents =
      Number(
        it?.subtotal_cents ??
          it?.subtotalCents ??
          it?.total_cents ??
          it?.totalCents ??
          Math.round(unitPriceCents * quantity)
      ) || 0;

    return {
      name,
      size,
      quantity,
      unitPriceCents,
      subtotalCents,
      category,
    };
  });

  const createdAt =
    dto?.created_at ?? dto?.createdAt ?? dto?.created_at?.toString?.() ?? "";

  const totalCents =
    Number(
      dto?.total_cents ??
        dto?.totalCents ??
        dto?.total ??
        Math.round(items.reduce((acc, it) => acc + (it.subtotalCents ?? 0), 0))
    ) || 0;

  const statusApi =
    dto?.status ??
    dto?.order_status ??
    dto?.OrderStatus ??
    dto?.Status ??
    "pending";

  const statusPt = fromApiStatus(statusApi);

  return {
    id,
    orderNumber: String(id || ""),
    createdAt,
    name: customerName || "",
    table: table || "",
    items,
    totalCents,
    status: statusPt,
  };
}

/* =========================================================
   Provider
   ========================================================= */
export const OrdersProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [orders, setOrders] = useState<OrderUI[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showErrorPopup, setShowErrorPopup] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Traz pedidos + itens (PostgREST nesting)
      const { data, error: sbErr } = await supabase
        .from("orders")
        .select(
          `
          *,
          order_items (*)
        `
        )
        .order("created_at", { ascending: false });

      if (sbErr) throw sbErr;

      const list: any[] = Array.isArray(data) ? data : [];
      const mapped = list.map(formatOrderDTO);
      setOrders(mapped);
    } catch (err: any) {
      setError(err?.message ?? "Erro ao carregar pedidos");
      setShowErrorPopup(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const createOrderFromCart = useCallback(
    async (params: CreateFromCartParams): Promise<OrderUI> => {
      const { name, table, items } = params;

      const safeItems = (items ?? []).filter((it) => (it?.quantity ?? 0) > 0);

      if (safeItems.length === 0) {
        const e = new Error("Carrinho vazio.");
        throw e;
      }

      const totalCents = safeItems.reduce(
        (acc, it) => acc + (it.unitPriceCents || 0) * (it.quantity || 0),
        0
      );

      // status inicial no padrão do teu mapper
      const initialStatusApi = "pending";

      try {
        // 1) cria pedido
        const { data: orderRow, error: orderErr } = await supabase
          .from("orders")
          .insert({
            customer_name: name,
            table_number: table,
            status: initialStatusApi,
            total_cents: totalCents,
          })
          .select("*")
          .single();

        if (orderErr) throw orderErr;

        const orderId = orderRow?.id;
        if (!orderId) throw new Error("Pedido criado sem id.");

        // 2) cria itens
        const itemsPayload = safeItems.map((it) => ({
          order_id: orderId,
          product_id: it.productId,
          name_snapshot: it.name ?? null,
          size: it.size ?? null,
          quantity: it.quantity,
          unit_price_cents: it.unitPriceCents,
          total_cents: it.unitPriceCents * it.quantity,
        }));

        const { error: itemsErr } = await supabase
          .from("order_items")
          .insert(itemsPayload);

        if (itemsErr) throw itemsErr;

        // 3) re-busca o pedido completo (com itens) pra devolver certinho pra UI
        const { data: full, error: fullErr } = await supabase
          .from("orders")
          .select(`*, order_items (*)`)
          .eq("id", orderId)
          .single();

        if (fullErr) throw fullErr;

        const formatted = formatOrderDTO(full);
        setOrders((prev) => [formatted, ...prev]);
        return formatted;
      } catch (err: any) {
        console.error("[OrdersContext] createOrderFromCart error:", err);

        const backendMsg = err?.message;
        const userMsg =
          backendMsg && String(backendMsg).trim().length > 0
            ? String(backendMsg)
            : "Não conseguimos salvar seu pedido. Tente novamente.";

        const e = new Error(userMsg);
        throw e;
      }
    },
    []
  );

  const updateOrderStatus = useCallback(
    async (id: number | string, newStatusPt: PtStatus) => {
      const status = toApiStatus(newStatusPt);

      try {
        const { error: sbErr } = await supabase
          .from("orders")
          .update({ status })
          .eq("id", id);

        if (sbErr) throw sbErr;

        setOrders((prev) =>
          prev.map((o) => (o.id === id ? { ...o, status: newStatusPt } : o))
        );
      } catch (err: any) {
        console.error("[OrdersContext] updateOrderStatus error:", err);
        throw err;
      }
    },
    []
  );

  const updateOrderInfo = useCallback(
    async (
      id: number | string,
      data: { name?: string; table?: string | number }
    ) => {
      try {
        const payload: any = {};
        if (typeof data.name !== "undefined") payload.customer_name = data.name;
        if (typeof data.table !== "undefined") payload.table_number = data.table;

        const { error: sbErr } = await supabase
          .from("orders")
          .update(payload)
          .eq("id", id);

        if (sbErr) throw sbErr;

        setOrders((prev) =>
          prev.map((o) =>
            o.id === id
              ? {
                  ...o,
                  name: typeof data.name !== "undefined" ? data.name : o.name,
                  table: typeof data.table !== "undefined" ? data.table : o.table,
                }
              : o
          )
        );
      } catch (err: any) {
        console.error("[OrdersContext] updateOrderInfo error:", err);
        throw err;
      }
    },
    []
  );

  const deleteOrder = useCallback(async (id: number | string) => {
    try {
      // com FK on delete cascade, itens vão junto
      const { error: sbErr } = await supabase.from("orders").delete().eq("id", id);
      if (sbErr) throw sbErr;

      setOrders((prev) => prev.filter((o) => o.id !== id));
    } catch (err: any) {
      console.error("[OrdersContext] deleteOrder error:", err);
      throw err;
    }
  }, []);

  const value = useMemo(
    () => ({
      orders,
      loading,
      error,
      refresh,
      createOrderFromCart,
      updateOrderStatus,
      updateOrderInfo,
      deleteOrder,
    }),
    [
      orders,
      loading,
      error,
      refresh,
      createOrderFromCart,
      updateOrderStatus,
      updateOrderInfo,
      deleteOrder,
    ]
  );

  return (
    <OrdersContext.Provider value={value}>
      {children}
      {showErrorPopup && error && (
        <ErrorPopup
          message={error}
          onClose={() => {
            setShowErrorPopup(false);
            setError(null);
          }}
        />
      )}
    </OrdersContext.Provider>
  );
};
