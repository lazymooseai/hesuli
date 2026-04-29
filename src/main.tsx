import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installErrorLog } from "./lib/errorLog";

installErrorLog();

createRoot(document.getElementById("root")!).render(<App />);
