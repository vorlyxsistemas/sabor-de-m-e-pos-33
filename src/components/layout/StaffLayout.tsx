import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";

interface StaffLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

export function StaffLayout({ children, title, subtitle }: StaffLayoutProps) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar variant="staff" />
        <div className="flex flex-1 flex-col">
          <AppHeader title={title} subtitle={subtitle} />
          <main className="flex-1 p-4 lg:p-6 animate-fade-in">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
