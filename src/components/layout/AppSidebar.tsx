'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { LayoutDashboard, ScanLine, FilePlus2 } from 'lucide-react'; // Replaced ScanSearch with ScanLine or FilePlus2

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/scan', label: 'Scan New', icon: FilePlus2 },
];

export default function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed top-16 z-30 -ml-2 hidden h-[calc(100vh-4rem)] w-full shrink-0 md:sticky md:block md:w-64">
      <ScrollArea className="h-full py-6 pr-6 lg:py-8">
        <nav className="flex flex-col space-y-2">
          {navItems.map((item) => (
            <Button
              key={item.href}
              asChild
              variant={pathname === item.href ? 'secondary' : 'ghost'}
              className={cn(
                'w-full justify-start',
                pathname === item.href && 'bg-sidebar-accent text-sidebar-accent-foreground'
              )}
            >
              <Link href={item.href}>
                <item.icon className="mr-2 h-5 w-5" />
                {item.label}
              </Link>
            </Button>
          ))}
        </nav>
      </ScrollArea>
    </aside>
  );
}
