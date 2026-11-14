import "./lib/api-origin";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./i18n";
import "highlight.js/styles/atom-one-dark.css";

createRoot(document.getElementById("root")!).render(<App />);
