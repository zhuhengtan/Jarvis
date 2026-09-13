import React from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { CustomLayout } from "../layouts/CustomLayout";
import { LoginPage } from "../pages/login";
import { DashboardPage } from "../pages/dashboard";
import { ProjectsPage } from "../pages/projects";
import { CandidatesPage } from "../pages/memory/candidates";
import { MemoryExplorerPage } from "../pages/memory/explorer";
import { SessionsPage } from "../pages/sessions";
import { GoalsPage } from "../pages/goals";
import { SkillsPage } from "../pages/skills";
import { IdentityPage } from "../pages/identity";

// Auth Guard: ensure admin is authenticated
const AuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const token = localStorage.getItem("JARVIS_ADMIN_TOKEN");
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/",
    element: (
      <AuthGuard>
        <CustomLayout />
      </AuthGuard>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="/dashboard" replace />,
      },
      {
        path: "dashboard",
        element: <DashboardPage />,
      },
      {
        path: "projects",
        element: <ProjectsPage />,
      },
      {
        path: "memory/candidates",
        element: <CandidatesPage />,
      },
      {
        path: "memory/explorer",
        element: <MemoryExplorerPage />,
      },
      {
        path: "sessions",
        element: <SessionsPage />,
      },
      {
        path: "goals",
        element: <GoalsPage />,
      },
      {
        path: "skills",
        element: <SkillsPage />,
      },
      {
        path: "identity",
        element: <IdentityPage />,
      },
      {
        path: "*",
        element: <Navigate to="/dashboard" replace />,
      },
    ],
  },
]);
