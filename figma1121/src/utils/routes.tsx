import { createBrowserRouter } from "react-router";
import { Root } from "../components/Root";
import { Home } from "../components/Home";
import { Search } from "../components/Search";
import { Collections } from "../components/Collections";
import { Settings } from "../components/Settings";
import { CollectionDetail } from "../components/CollectionDetail";
import { Statistics } from "../components/Statistics";
import { NotFound } from "../components/NotFound";
import { Login } from "../components/Login";

export const router = createBrowserRouter([
  {
    path: "/login",
    Component: Login,
  },
  {
    path: "/",
    Component: Root,
    errorElement: <NotFound />,
    children: [
      { index: true, Component: Home },
      { path: "search", Component: Search },
      { path: "collections", Component: Collections },
      { path: "collections/:id", Component: CollectionDetail },
      { path: "statistics", Component: Statistics },
      { path: "settings", Component: Settings },
      { path: "*", Component: NotFound },
    ],
  },
]);