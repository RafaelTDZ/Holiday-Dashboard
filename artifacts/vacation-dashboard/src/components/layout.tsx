import { Link, useLocation } from "wouter";
import { useAuth } from "@workspace/replit-auth-web";
import { 
  Sidebar, 
  SidebarContent, 
  SidebarFooter, 
  SidebarGroup, 
  SidebarGroupContent, 
  SidebarHeader, 
  SidebarMenu, 
  SidebarMenuButton, 
  SidebarMenuItem, 
  SidebarProvider, 
  SidebarTrigger 
} from "@/components/ui/sidebar";
import { LayoutDashboard, Users, LogOut, Briefcase } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background/50">
        <Sidebar className="border-r shadow-sm">
          <SidebarHeader className="h-16 flex items-center px-4 border-b">
            <div className="flex items-center gap-2 font-bold text-lg text-sidebar-foreground">
              <Briefcase className="w-6 h-6 text-sidebar-primary" />
              <span>Dashboard de Férias</span>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent className="py-4">
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton 
                      asChild 
                      isActive={location === "/"}
                      tooltip="Dashboard"
                    >
                      <Link href="/">
                        <LayoutDashboard />
                        <span>Visão Geral</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton 
                      asChild 
                      isActive={location.startsWith("/employees")}
                      tooltip="Funcionários"
                    >
                      <Link href="/employees">
                        <Users />
                        <span>Funcionários</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter className="border-t p-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-9 w-9 border border-sidebar-border bg-sidebar-accent">
                <AvatarImage src={user?.profileImageUrl || ""} />
                <AvatarFallback className="text-sidebar-foreground bg-transparent">
                  {user?.firstName?.charAt(0) || user?.email?.charAt(0) || "U"}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col flex-1 overflow-hidden">
                <span className="text-sm font-medium text-sidebar-foreground truncate">
                  {user?.firstName} {user?.lastName}
                </span>
                <span className="text-xs text-sidebar-foreground/70 truncate">
                  {user?.email}
                </span>
              </div>
              <Button variant="ghost" size="icon" onClick={logout} className="text-sidebar-foreground hover:bg-sidebar-accent/50" data-testid="button-logout" title="Sair">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </SidebarFooter>
        </Sidebar>
        <main className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
          <header className="h-16 flex items-center px-6 border-b bg-card/50 backdrop-blur sticky top-0 z-10 lg:hidden">
            <SidebarTrigger className="-ml-2" />
            <div className="ml-4 font-semibold">Dashboard de Férias</div>
          </header>
          <div className="flex-1 overflow-auto p-6 md:p-8">
            <div className="mx-auto max-w-6xl">
              {children}
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
