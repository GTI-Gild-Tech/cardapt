// components/navigation/DashboardLayout.tsx
import React from "react";
import { Outlet } from "react-router-dom";
// correto
import Navbar from "./navigation/Navbar";

export function DashboardLayout() {
  return (
    <div className="bg-bgBege h-full">
      {/* Navbar fica sempre fixa dentro deste layout */}
      <Navbar />
      {/* O Outlet renderiza o componente da rota filha */}
      <Outlet />
      
    </div>
  );
}