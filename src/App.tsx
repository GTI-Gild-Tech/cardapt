// src/App.tsx
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from './components/auth/AuthContext';
import { ProductsProvider } from "./components/context/ProductsContext";
import { CartProvider } from "./components/context/CartContext";
import { OrdersProvider } from "./components/context/OrdersContext";

import { Login } from "./components/auth/Login";
import { PrivateRoute } from "./components/auth/PrivateRoute";

import { PublicSite } from "./components/public_site/PublicSite";
import { DashboardLayout } from "./components/DashboardLayout";

import { HomeContent } from "./components/home/HomeContent";
import PedidosContent from "./components/pedidos/PedidosContent";
import { FidelidadeContent } from "./components/fidelidade/FidelidadeContent";
import { CardapioContent } from "./components/cardapio/CardapioContent";

function AppInner() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PublicSite />} />
        <Route path="/dashboard-admin/login" element={<Login />} />
        <Route element={<PrivateRoute />}>
          <Route path="/dashboard-admin" element={<DashboardLayout />}>
            <Route index element={<Navigate to="home" replace />} />
            <Route path="home" element={<HomeContent />} />
            <Route path="pedidos" element={<PedidosContent />} />
            <Route path="fidelidade" element={<FidelidadeContent />} />
            <Route path="cardapio" element={<CardapioContent />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <AuthProvider> {/* ← AuthProvider primeiro */}
      <ProductsProvider> {/* ← ProductsProvider dentro do AuthProvider */}
        <CartProvider>
          <OrdersProvider>
            <AppInner />
          </OrdersProvider>
        </CartProvider>
      </ProductsProvider>
    </AuthProvider>
  );
}