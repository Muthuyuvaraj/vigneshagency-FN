import { useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Receipt, Users, Package, BarChart3 } from "lucide-react";

const navItems = [
  { icon: LayoutDashboard, label: "Home", path: "/" },
  { icon: Receipt, label: "Billing", path: "/billing" },
  { icon: Users, label: "Dealers", path: "/dealers" },
  { icon: Package, label: "Products", path: "/products" },
  { icon: BarChart3, label: "Reports", path: "/reports" },
];

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t safe-bottom print:hidden">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          return (
            <button
              key={item.path}
              type="button"
              onClick={() => navigate(item.path)}
              className={`flex flex-1 min-w-0 flex-col items-center justify-center gap-0.5 py-2 touch-target transition-colors ${
                isActive ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="text-[10px] font-medium truncate max-w-full px-0.5">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
