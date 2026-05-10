import { ReactNode } from "react";
import BottomNav from "./BottomNav";

interface AppLayoutProps {
  children: ReactNode;
  title?: string;
}

const AppLayout = ({ children, title }: AppLayoutProps) => {
  return (
    <div className="min-h-screen bg-background flex flex-col max-w-lg mx-auto w-full min-w-0 print:max-w-none print:min-h-0 print:bg-white">
      {title && (
        <header className="sticky top-0 z-40 bg-card border-b px-4 py-3 shrink-0 print:hidden">
          <h1 className="text-lg font-semibold text-foreground truncate">{title}</h1>
        </header>
      )}
      <main className="flex-1 px-4 py-4 pb-24 overflow-y-auto min-w-0 w-full max-w-full print:px-1 print:py-2 print:pb-2 print:overflow-visible">
        {children}
      </main>
      <BottomNav />
    </div>
  );
};

export default AppLayout;
