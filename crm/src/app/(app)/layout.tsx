import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full">
      <Sidebar />
      <div className="flex flex-col flex-1 ml-60 min-h-screen">
        <Header />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
