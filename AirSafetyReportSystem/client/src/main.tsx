import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initErrorTracker } from "@/lib/errorTracker";

initErrorTracker();

createRoot(document.getElementById("root")!).render(<App />);
