import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, TrendingDown, Heart, Package } from "lucide-react";

interface Stats {
  totalProducts: number;
  riskProducts: number;
  discounted: number;
  donated: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    totalProducts: 0,
    riskProducts: 0,
    discounted: 0,
    donated: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      const today = new Date().toISOString().split("T")[0];
      const riskDate = new Date();
      riskDate.setDate(riskDate.getDate() + 3);
      const riskDateStr = riskDate.toISOString().split("T")[0];

      const [productsRes, riskRes, discountRes, donationRes] = await Promise.all([
        supabase.from("products").select("id", { count: "exact", head: true }),
        supabase
          .from("products")
          .select("id", { count: "exact", head: true })
          .lte("expiry_date", riskDateStr)
          .gte("expiry_date", today),
        supabase
          .from("action_history")
          .select("id", { count: "exact", head: true })
          .eq("action_type", "discount"),
        supabase
          .from("action_history")
          .select("id", { count: "exact", head: true })
          .eq("action_type", "donation"),
      ]);

      setStats({
        totalProducts: productsRes.count ?? 0,
        riskProducts: riskRes.count ?? 0,
        discounted: discountRes.count ?? 0,
        donated: donationRes.count ?? 0,
      });
      setLoading(false);
    }

    fetchStats();
  }, []);

  const cards = [
    {
      title: "Ukupno proizvoda",
      value: stats.totalProducts,
      icon: Package,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      title: "Rizični proizvodi",
      value: stats.riskProducts,
      icon: AlertTriangle,
      color: "text-warning",
      bg: "bg-warning/10",
    },
    {
      title: "Sniženja",
      value: stats.discounted,
      icon: TrendingDown,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      title: "Donacije",
      value: stats.donated,
      icon: Heart,
      color: "text-destructive",
      bg: "bg-destructive/10",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Pregled stanja i efekata</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.title} className="shadow-card hover:shadow-soft transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.title}
                </CardTitle>
                <div className={`p-2 rounded-lg ${card.bg}`}>
                  <Icon className={`h-4 w-4 ${card.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold font-heading">
                  {loading ? "..." : card.value}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
