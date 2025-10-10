import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from '@/components/ui/navigation-menu';
import { 
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { LogOut, User, Settings, Truck, Menu, Home, BarChart3, Package, Users, MapPin, FileText, Building } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';

export const Header = () => {
  const { user, company, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'DRIVER': return 'text-primary';
      case 'MASTER': return 'text-purple-500';
      case 'ADMIN': return 'text-danger';
      case 'SUPERVISOR': 
      case 'OPERATOR': return 'text-warning';
      case 'CLIENT': return 'text-success';
      // Compatibilidade com roles antigas
      case 'MOTORISTA': return 'text-primary';
      case 'ADMINISTRADOR': return 'text-danger';
      case 'OPERADOR': return 'text-warning';
      default: return 'text-muted-foreground';
    }
  };

  const getRoleDisplay = (role: string) => {
    switch (role) {
      case 'MASTER': return 'Master';
      case 'ADMIN': return 'Administrador';
      case 'SUPERVISOR': return 'Supervisor';
      case 'OPERATOR': return 'Operador';
      case 'DRIVER': return 'Motorista';
      case 'CLIENT': return 'Cliente';
      // Compatibilidade com roles antigas
      case 'MOTORISTA': return 'Motorista';
      case 'ADMINISTRADOR': return 'Administrador';
      case 'OPERADOR': return 'Operador';
      default: return role;
    }
  };

  // Navegação específica por perfil
  const getNavigationItems = () => {
    switch (user?.role) {
      case 'MASTER':
        return [
          { href: '/dashboard', label: 'Dashboard Master', icon: Home },
          { href: '/dashboard/empresas', label: 'Empresas', icon: Building },
          { href: '/dashboard/usuarios', label: 'Usuários', icon: Users },
          { href: '/dashboard/relatorios', label: 'Relatórios', icon: BarChart3 },
        ];
      case 'ADMIN':
        return [
          { href: '/dashboard', label: 'Dashboard', icon: Home },
          { href: '/dashboard/usuarios', label: 'Usuários', icon: Users },
          { href: '/dashboard/veiculos', label: 'Veículos', icon: Truck },
          { href: '/dashboard/entregas', label: 'Canhotos', icon: FileText },
          { href: '/dashboard/relatorios', label: 'Relatórios', icon: BarChart3 },
          { href: '/dashboard/rastreamento', label: 'Rastreamento', icon: MapPin },
        ];
      case 'SUPERVISOR':
      case 'OPERATOR':
        return [
          { href: '/dashboard', label: 'Dashboard', icon: Home },
          { href: '/dashboard/entregas', label: 'Canhotos', icon: FileText },
          { href: '/dashboard/relatorios', label: 'Relatórios', icon: BarChart3 },
          { href: '/dashboard/rastreamento', label: 'Rastreamento', icon: MapPin },
        ];
      case 'DRIVER':
      case 'MOTORISTA':
        return [
          { href: '/dashboard', label: 'Minhas Entregas', icon: Package },
          { href: '/dashboard/rastreamento', label: 'Rastreamento', icon: MapPin },
        ];
      case 'CLIENT':
        return [
          { href: '/dashboard', label: 'Minhas Entregas', icon: Package },
          { href: '/dashboard/relatorios', label: 'Relatórios', icon: BarChart3 },
        ];
      default:
        return [];
    }
  };

  // Breadcrumbs dinâmicos
  const getBreadcrumbs = () => {
    const pathSegments = location.pathname.split('/').filter(Boolean);
    const breadcrumbs = [{ href: '/', label: 'Início' }];
    
    pathSegments.forEach((segment, index) => {
      const href = '/' + pathSegments.slice(0, index + 1).join('/');
      const label = segment.charAt(0).toUpperCase() + segment.slice(1);
      breadcrumbs.push({ href, label });
    });
    
    return breadcrumbs;
  };

  const navigationItems = getNavigationItems();
  const breadcrumbs = getBreadcrumbs();

  return (
    <header className="bg-gradient-primary shadow-card border-b border-border">
      <div className="flex items-center justify-between px-4 md:px-6 py-4">
        {/* Logo e Navegação */}
        <div className="flex items-center gap-4">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <Truck className="h-6 w-6 text-white" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-xl font-bold text-white">ID Transporte</h1>
              <p className="text-primary-light text-sm">
                {company ? company.name : 'Sistema de Gestão de Entregas'}
              </p>
            </div>
          </div>

          {/* Navegação Desktop */}
          <NavigationMenu className="hidden lg:flex">
            <NavigationMenuList>
              {navigationItems.map((item) => (
                <NavigationMenuItem key={item.href}>
                  <NavigationMenuLink
                    className={navigationMenuTriggerStyle()}
                    onClick={() => navigate(item.href)}
                  >
                    <item.icon className="h-4 w-4 mr-2" />
                    {item.label}
                  </NavigationMenuLink>
                </NavigationMenuItem>
              ))}
            </NavigationMenuList>
          </NavigationMenu>
        </div>

        {/* User Menu */}
        <div className="flex items-center gap-4">
          {/* Breadcrumbs Mobile */}
          <div className="lg:hidden">
            <Breadcrumb>
              <BreadcrumbList className="text-white text-sm">
                {breadcrumbs.slice(-2).map((crumb, index) => (
                  <div key={crumb.href} className="flex items-center">
                    {index > 0 && <BreadcrumbSeparator className="text-white/60" />}
                    <BreadcrumbItem>
                      <BreadcrumbLink 
                        href={crumb.href}
                        className="text-white/80 hover:text-white"
                      >
                        {crumb.label}
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                  </div>
                ))}
              </BreadcrumbList>
            </Breadcrumb>
          </div>

          {/* User Info */}
          <div className="text-right hidden sm:block">
            <p className="text-white font-medium">{user?.name}</p>
            <p className={`text-sm ${getRoleColor(user?.role || '')}`}>
              {getRoleDisplay(user?.role || '')}
            </p>
            {company && (
              <p className="text-white/70 text-xs">{company.domain}</p>
            )}
          </div>

          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden text-white min-h-[44px] min-w-[44px]"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <Menu className="h-6 w-6" />
          </Button>

          {/* User Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                <Avatar className="h-10 w-10 border-2 border-white/20">
                  <AvatarFallback className="bg-white/20 text-white font-medium">
                    {user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end">
              <DropdownMenuItem className="flex items-center gap-2 min-h-[44px] text-base">
                <User className="h-4 w-4" />
                <span>Perfil</span>
              </DropdownMenuItem>
              {company && (
                <DropdownMenuItem className="flex items-center gap-2 min-h-[44px] text-base">
                  <Building className="h-4 w-4" />
                  <span>{company.name}</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem className="flex items-center gap-2 min-h-[44px] text-base">
                <Settings className="h-4 w-4" />
                <span>Configurações</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                className="flex items-center gap-2 text-destructive min-h-[44px] text-base"
                onClick={logout}
              >
                <LogOut className="h-4 w-4" />
                <span>Sair</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Breadcrumbs Desktop */}
      <div className="hidden lg:block px-6 pb-4">
        <Breadcrumb>
          <BreadcrumbList className="text-white/80">
            {breadcrumbs.map((crumb, index) => (
              <div key={crumb.href} className="flex items-center">
                {index > 0 && <BreadcrumbSeparator className="text-white/60" />}
                <BreadcrumbItem>
                  {index === breadcrumbs.length - 1 ? (
                    <BreadcrumbPage className="text-white font-medium">
                      {crumb.label}
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink 
                      href={crumb.href}
                      className="text-white/80 hover:text-white transition-colors"
                    >
                      {crumb.label}
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </div>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-white/10 backdrop-blur-sm border-t border-white/20">
          <div className="px-4 py-2 space-y-2">
            {navigationItems.map((item) => (
              <Button
                key={item.href}
                variant="ghost"
                className="w-full justify-start text-white hover:bg-white/20 min-h-[48px] py-3 text-base"
                onClick={() => {
                  navigate(item.href);
                  setMobileMenuOpen(false);
                }}
              >
                <item.icon className="h-5 w-5 mr-3" />
                {item.label}
              </Button>
            ))}
          </div>
        </div>
      )}
    </header>
  );
};