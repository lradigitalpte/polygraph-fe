import Header from "@/components/header";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-rows-[auto_1fr] min-h-screen">
      <Header />
      {children}
    </div>
  );
}
