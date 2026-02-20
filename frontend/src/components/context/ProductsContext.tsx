import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  PropsWithChildren,
} from "react";
import type { Product } from "../cardapio/KanbanComponents";
 import { supabase } from '../../lib/supabase';


// =====================
// Helpers (preço/JSON)
// =====================

// "1.234,56" | "1234,56" | "1234.56" | 12.5 -> 123456 (cents)
function moneyToCents(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return Math.round(v * 100);

  const s = String(v).trim();
  if (!s) return 0;

  // remove separador de milhar e normaliza decimal
  const norm = s.replace(/\./g, "").replace(",", ".");
  const n = Number(norm);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function centsToMoney(cents: unknown): number {
  const n = Number(cents);
  if (!Number.isFinite(n)) return 0;
  return n / 100;
}

type SizeRow = {
  label: string;
  price_cents: number;
  qty: number;
};

// Converte o Product da UI -> sizes JSONB do banco
function productToSizesJson(p: Product): SizeRow[] {
  const raw = Array.isArray(p.sizes) ? p.sizes : [];
  return raw.map((s: any) => ({
    label: String(s.size ?? s.label ?? s.name ?? "Único"),
    price_cents: moneyToCents(s.price ?? s.price_cents ?? 0),
    qty: Math.max(1, Number(s.qty ?? s.quantity ?? 1) || 1),
  }));
}

// Converte sizes JSONB do banco -> Product.sizes (UI usa reais)
function sizesJsonToProductSizes(sizes: any): { size: string; price: number; qty?: number }[] {
  if (!Array.isArray(sizes)) return [];
  return sizes.map((s: any) => ({
    size: String(s.label ?? s.size ?? s.name ?? "Único"),
    price: centsToMoney(s.price_cents ?? s.priceCents ?? 0),
    qty: Math.max(1, Number(s.qty ?? 1) || 1),
  }));
}

// =====================
// Storage (imagem)
// =====================

const BUCKET = "product-images"; // crie esse bucket no Supabase Storage

function buildImagePath(productId: string, file: File) {
  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  return `products/${productId}/${Date.now()}.${ext}`;
}

async function uploadProductImage(productId: string, file: File) {
  const path = buildImagePath(productId, file);

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true });

  if (upErr) throw upErr;

  // Se o bucket for público:
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// =====================
// Tipos do Contexto
// =====================

type ProductsCtx = {
  products: Product[];
  categories: string[];
  loading: boolean;
  error: string | null;

  fetchData: () => Promise<void>;

  addProduct: (p: Product, imageFile?: File) => Promise<void>;
  updateProduct: (p: Product, imageFile?: File) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  moveProduct: (id: string, newCategory: string) => Promise<void>;
  reorderProducts: (category: string, productId: string, newIndex: number) => Promise<void>;

  addCategory: (name: string) => Promise<void>;
  updateCategory: (oldName: string, newName: string) => Promise<void>;
  deleteCategory: (name: string) => Promise<void>;
  reorderCategories: (categoryName: string, newIndex: number) => Promise<void>;
};

const ProductsContext = createContext<ProductsCtx | undefined>(undefined);

// =====================
// Provider
// =====================

export const ProductsProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // name -> id
  const [categoryByName, setCategoryByName] = useState<Record<string, string>>({});
  // id -> name (pra mapear produtos)
  const [categoryNameById, setCategoryNameById] = useState<Record<string, string>>({});

  // =====================
  // Fetch (hidratação)
  // =====================
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // 1) categorias (ordenadas pelo "order")
      const { data: cats, error: catsErr } = await supabase
        .from("categories")
        .select("id,name,order")
        .order("order", { ascending: true });

      if (catsErr) throw catsErr;

      const names = (cats ?? []).map((c: any) => String(c.name));
      setCategories(names);

      const byName: Record<string, string> = {};
      const byId: Record<string, string> = {};
      for (const c of cats ?? []) {
        byName[String(c.name)] = String(c.id);
        byId[String(c.id)] = String(c.name);
      }
      setCategoryByName(byName);
      setCategoryNameById(byId);

      // 2) produtos (ordenados por categoria_id + order)
      const { data: prods, error: prodsErr } = await supabase
        .from("products")
        .select("id,name,description,image_url,order,sizes,category_id")
        .order("category_id", { ascending: true })
        .order("order", { ascending: true });

      if (prodsErr) throw prodsErr;

      const mapped: Product[] = (prods ?? []).map((p: any) => ({
        id: String(p.id),
        name: String(p.name),
        description: p.description ?? "",
        category: byId[String(p.category_id)] ?? "Sem categoria",
        sizes: sizesJsonToProductSizes(p.sizes),
        imageUrl: p.image_url ?? "",
        order: p.order ?? 0,
      }));

      setProducts(mapped);
    } catch (e: any) {
      setError(e?.message ?? "Erro ao buscar dados no Supabase");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // =====================
  // Helpers de estado
  // =====================
  const replaceProductLocal = useCallback((p: Product) => {
    setProducts((prev) => prev.map((x) => (x.id === p.id ? p : x)));
  }, []);

  const removeProductLocal = useCallback((id: string) => {
    setProducts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  // =====================
  // Categorias (CRUD + ordem)
  // =====================
  const addCategory = useCallback(
    async (name: string) => {
      const n = name.trim();
      if (!n) return;

      if (categories.includes(n)) {
        throw new Error("Esta categoria já existe!");
      }

      // ordem = fim
      const newOrder = categories.length;

      // otimista
      setCategories((prev) => [...prev, n]);

      const { data, error: insErr } = await supabase
        .from("categories")
        .insert({ name: n, order: newOrder })
        .select("id,name,order")
        .single();

      if (insErr) {
        // rollback
        setCategories((prev) => prev.filter((c) => c !== n));
        throw insErr;
      }

      // atualizar maps
      setCategoryByName((m) => ({ ...m, [n]: String(data.id) }));
      setCategoryNameById((m) => ({ ...m, [String(data.id)]: n }));
    },
    [categories]
  );

  const updateCategory = useCallback(
    async (oldName: string, newName: string) => {
      const nn = newName.trim();
      if (!nn) return;
      if (oldName === nn) return;
      if (categories.includes(nn)) throw new Error("Esta categoria já existe!");

      const id = categoryByName[oldName];
      if (!id) throw new Error("Categoria não encontrada (map name->id vazio).");

      const prevCats = categories.slice();
      const prevProds = products.slice();

      // otimista
      setCategories((prev) => prev.map((c) => (c === oldName ? nn : c)));
      setProducts((prev) => prev.map((p) => (p.category === oldName ? { ...p, category: nn } : p)));

      const { error: upErr } = await supabase.from("categories").update({ name: nn }).eq("id", id);
      if (upErr) {
        setCategories(prevCats);
        setProducts(prevProds);
        throw upErr;
      }

      // map updates
      setCategoryByName((m) => {
        const clone = { ...m };
        const keepId = clone[oldName];
        delete clone[oldName];
        clone[nn] = keepId;
        return clone;
      });
      setCategoryNameById((m) => ({ ...m, [id]: nn }));
    },
    [categories, products, categoryByName]
  );

  const deleteCategory = useCallback(
    async (name: string) => {
      const id = categoryByName[name];
      if (!id) throw new Error("Categoria não encontrada (map name->id vazio).");

      // regra local (sua UI já faz): não deletar se tiver produto
      const hasProducts = products.some((p) => p.category === name);
      if (hasProducts) throw new Error("Não é possível excluir categoria com produtos.");

      const prevCats = categories.slice();
      setCategories((prev) => prev.filter((c) => c !== name)); // otimista

      const { error: delErr } = await supabase.from("categories").delete().eq("id", id);
      if (delErr) {
        setCategories(prevCats);
        throw delErr;
      }

      // limpa maps
      setCategoryByName((m) => {
        const clone = { ...m };
        delete clone[name];
        return clone;
      });
      setCategoryNameById((m) => {
        const clone = { ...m };
        delete clone[id];
        return clone;
      });
    },
    [categoryByName, categories, products]
  );

  const reorderCategories = useCallback(
    async (categoryName: string, newIndex: number) => {
      const currIndex = categories.indexOf(categoryName);
      if (currIndex === -1) return;
      if (currIndex === newIndex) return;

      const prevCats = categories.slice();

      // otimista
      const next = categories.slice();
      const [moved] = next.splice(currIndex, 1);
      next.splice(newIndex, 0, moved);
      setCategories(next);

      // persistir: atualiza order de TODAS (simples e consistente)
      try {
        const updates = next.map((name, idx) => ({
          id: categoryByName[name],
          order: idx,
        }));

        // valida ids
        if (updates.some((u) => !u.id)) throw new Error("Map de categoria quebrado (faltando id).");

        const { error: upErr } = await supabase.from("categories").upsert(updates, { onConflict: "id" });
        if (upErr) throw upErr;
      } catch (e) {
        setCategories(prevCats);
        throw e;
      }
    },
    [categories, categoryByName]
  );

  // =====================
  // Produtos (CRUD + move + ordem)
  // =====================
  const addProduct = useCallback(
    async (p: Product, imageFile?: File) => {
      const catId = categoryByName[p.category];
      if (!catId) throw new Error("Categoria inválida (sem id). Crie a categoria antes.");

      // order = fim da categoria
      const maxOrder = Math.max(
        -1,
        ...products.filter((x) => x.category === p.category).map((x) => x.order ?? 0)
      );
      const newOrder = maxOrder + 1;

      // otimista (id temporário)
      const tempId = crypto.randomUUID();
      const tempUrl = imageFile ? URL.createObjectURL(imageFile) : p.imageUrl;
      const optimistic: Product = {
        ...p,
        id: tempId,
        order: newOrder,
        imageUrl: tempUrl ?? "",
      };
      setProducts((prev) => [optimistic, ...prev]);

      try {
        // 1) insert no banco (sem imagem primeiro)
        const payload = {
          category_id: catId,
          name: p.name,
          description: p.description ?? "",
          order: newOrder,
          sizes: productToSizesJson(p), // jsonb
          image_url: null as string | null,
        };

        const { data: created, error: insErr } = await supabase
          .from("products")
          .insert(payload)
          .select("id,category_id,name,description,image_url,order,sizes")
          .single();

        if (insErr) throw insErr;

        let imageUrlFinal = created.image_url ?? "";

        // 2) upload imagem se veio arquivo
        if (imageFile) {
          imageUrlFinal = await uploadProductImage(String(created.id), imageFile);

          const { error: imgErr } = await supabase
            .from("products")
            .update({ image_url: imageUrlFinal })
            .eq("id", created.id);

          if (imgErr) throw imgErr;
        }

        // 3) substituir o produto otimista
        const finalProduct: Product = {
          id: String(created.id),
          name: String(created.name),
          description: created.description ?? "",
          category: p.category,
          sizes: sizesJsonToProductSizes(created.sizes),
          imageUrl: imageUrlFinal ?? "",
          order: created.order ?? 0,
        };

        setProducts((prev) => prev.map((x) => (x.id === tempId ? finalProduct : x)));
      } catch (e) {
        // rollback
        setProducts((prev) => prev.filter((x) => x.id !== tempId));
        throw e;
      } finally {
        if (imageFile && tempUrl) URL.revokeObjectURL(tempUrl);
      }
    },
    [categoryByName, products]
  );

  const updateProduct = useCallback(
    async (p: Product, imageFile?: File) => {
      const prev = products.find((x) => x.id === p.id);
      if (!prev) return;

      const catId = categoryByName[p.category];
      if (!catId) throw new Error("Categoria inválida (sem id).");

      // otimista
      replaceProductLocal(p);

      try {
        let imageUrlFinal = p.imageUrl ?? prev.imageUrl ?? "";

        if (imageFile) {
          imageUrlFinal = await uploadProductImage(p.id, imageFile);
        }

        const payload = {
          category_id: catId,
          name: p.name,
          description: p.description ?? "",
          sizes: productToSizesJson(p),
          image_url: imageUrlFinal || null,
        };

        const { data, error: upErr } = await supabase
          .from("products")
          .update(payload)
          .eq("id", p.id)
          .select("id,category_id,name,description,image_url,order,sizes")
          .single();

        if (upErr) throw upErr;

        const updated: Product = {
          id: String(data.id),
          name: String(data.name),
          description: data.description ?? "",
          category: categoryNameById[String(data.category_id)] ?? p.category,
          sizes: sizesJsonToProductSizes(data.sizes),
          imageUrl: data.image_url ?? "",
          order: data.order ?? 0,
        };

        replaceProductLocal(updated);
      } catch (e) {
        // rollback
        replaceProductLocal(prev);
        throw e;
      }
    },
    [products, categoryByName, categoryNameById, replaceProductLocal]
  );

  const deleteProduct = useCallback(
    async (id: string) => {
      const snapshot = products.slice();

      // otimista
      removeProductLocal(id);

      const { error: delErr } = await supabase.from("products").delete().eq("id", id);
      if (delErr) {
        setProducts(snapshot);
        throw delErr;
      }
    },
    [products, removeProductLocal]
  );

  const moveProduct = useCallback(
    async (id: string, newCategory: string) => {
      const prev = products.find((x) => x.id === id);
      if (!prev) return;

      const newCatId = categoryByName[newCategory];
      if (!newCatId) throw new Error("Categoria destino inválida.");

      // ordem = fim na nova categoria
      const maxOrder = Math.max(
        -1,
        ...products.filter((x) => x.category === newCategory).map((x) => x.order ?? 0)
      );
      const newOrder = maxOrder + 1;

      // otimista
      replaceProductLocal({ ...prev, category: newCategory, order: newOrder });

      const { error: upErr } = await supabase
        .from("products")
        .update({ category_id: newCatId, order: newOrder })
        .eq("id", id);

      if (upErr) {
        replaceProductLocal(prev);
        throw upErr;
      }
    },
    [products, categoryByName, replaceProductLocal]
  );

  const reorderProducts = useCallback(
    async (category: string, productId: string, newIndex: number) => {
      const snapshot = products.slice();

      const list = products
        .filter((p) => p.category === category)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

      const fromIndex = list.findIndex((p) => p.id === productId);
      if (fromIndex === -1) return;
      if (fromIndex === newIndex) return;

      // otimista reorder
      const nextList = list.slice();
      const [moved] = nextList.splice(fromIndex, 1);
      nextList.splice(newIndex, 0, moved);

      const updated = nextList.map((p, idx) => ({ ...p, order: idx }));

      setProducts((prev) => {
        const others = prev.filter((p) => p.category !== category);
        return [...others, ...updated];
      });

      try {
        // persistir: upsert de {id, order} pra todos da categoria
        const updates = updated.map((p) => ({ id: p.id, order: p.order ?? 0 }));
        const { error: upErr } = await supabase.from("products").upsert(updates, { onConflict: "id" });
        if (upErr) throw upErr;
      } catch (e) {
        setProducts(snapshot);
        throw e;
      }
    },
    [products]
  );

  // =====================
  // Value
  // =====================
  const value: ProductsCtx = useMemo(
    () => ({
      products,
      categories,
      loading,
      error,
      fetchData,
      addProduct,
      updateProduct,
      deleteProduct,
      moveProduct,
      reorderProducts,
      addCategory,
      updateCategory,
      deleteCategory,
      reorderCategories,
    }),
    [
      products,
      categories,
      loading,
      error,
      fetchData,
      addProduct,
      updateProduct,
      deleteProduct,
      moveProduct,
      reorderProducts,
      addCategory,
      updateCategory,
      deleteCategory,
      reorderCategories,
    ]
  );

  return <ProductsContext.Provider value={value}>{children}</ProductsContext.Provider>;
};

// =====================
// Hook
// =====================
export const useProducts = () => {
  const ctx = useContext(ProductsContext);
  if (!ctx) throw new Error("useProducts must be used within a ProductsProvider");
  return ctx;
};
