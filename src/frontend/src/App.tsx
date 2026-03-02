import { Toaster } from "@/components/ui/sonner";
import {
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import ContractDetailPage from "./pages/ContractDetailPage";
import ContractsPage from "./pages/ContractsPage";

const rootRoute = createRootRoute({
  component: () => (
    <>
      <Toaster position="top-right" richColors />
      <Outlet />
    </>
  ),
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: ContractsPage,
});

const contractDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/contract/$id",
  component: ContractDetailPage,
});

const routeTree = rootRoute.addChildren([indexRoute, contractDetailRoute]);

const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

export default function App() {
  return <RouterProvider router={router} />;
}
