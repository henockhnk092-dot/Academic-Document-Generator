import { useQuery } from "@tanstack/react-query";
import { BarChart3, FileText, Presentation, FileSpreadsheet, GraduationCap, TrendingUp, Calendar, Clock, Zap, Image as ImageIcon, Download, Filter } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/components/auth-provider";
import { getFirebaseDb } from "@/lib/firebase";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

const iconMap: Record<string, any> = {
  report: FileText,
  powerpoint: Presentation,
  conference: FileSpreadsheet,
  thesis: GraduationCap,
  image: ImageIcon,
};

const colorMap: Record<string, string> = {
  report: "text-blue-500",
  powerpoint: "text-orange-500",
  conference: "text-purple-500",
  thesis: "text-green-500",
  image: "text-pink-500",
};

const bgColorMap: Record<string, string> = {
  report: "bg-blue-500",
  powerpoint: "bg-orange-500",
  conference: "bg-purple-500",
  thesis: "bg-green-500",
  image: "bg-pink-500",
};

const typeLabels: Record<string, string> = {
  report: "Technical Reports",
  powerpoint: "Presentations",
  conference: "Conference Papers",
  thesis: "Thesis Documents",
  image: "AI Images",
};

export default function Analytics() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [dateRange, setDateRange] = useState<string>("all"); // all, month, week

  // Fetch documents
  const { data: documents, isLoading: docsLoading } = useQuery({
    queryKey: ["documents", user?.uid],
    queryFn: async () => {
      const db = getFirebaseDb();
      if (!db || !user?.uid) return [];

      const docsRef = collection(db, "documents");
      const q = query(docsRef, where("userId", "==", user.uid), orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        type: doc.data().type,
        title: doc.data().title,
        createdAt: doc.data().createdAt,
        language: doc.data().language,
      }));
    },
    enabled: isAuthenticated && !!user?.uid,
  });

  // Fetch images
  const { data: images, isLoading: imagesLoading } = useQuery({
    queryKey: ["images", user?.uid],
    queryFn: async () => {
      const db = getFirebaseDb();
      if (!db || !user?.uid) return [];

      const imagesRef = collection(db, "images");
      const q = query(imagesRef, where("userId", "==", user.uid), orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        type: "image",
        title: doc.data().prompt || "AI Generated Image",
        createdAt: doc.data().createdAt,
        imageUrl: doc.data().imageUrl,
      }));
    },
    enabled: isAuthenticated && !!user?.uid,
  });

  const isLoading = docsLoading || imagesLoading;

  // Helper to parse timestamps (can be string or number)
  const parseTimestamp = (createdAt: any): number => {
    const timestamp = typeof createdAt === 'string'
      ? parseInt(createdAt, 10)
      : createdAt;
    return isNaN(timestamp) ? Date.now() : timestamp;
  };

  // Helper to get Date object from createdAt
  const getDate = (createdAt: any): Date => {
    return new Date(parseTimestamp(createdAt));
  };

  // Combine documents and images
  const allItems = [...(documents || []), ...(images || [])].sort((a, b) => {
    const dateA = parseTimestamp(a.createdAt);
    const dateB = parseTimestamp(b.createdAt);
    return dateB - dateA;
  });

  // Filter items based on date range
  const now = new Date();
  const filteredItems = allItems.filter((item: any) => {
    if (dateRange === "all") return true;

    const itemDate = getDate(item.createdAt);

    if (dateRange === "month") {
      return itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear();
    }

    if (dateRange === "week") {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return itemDate >= weekAgo;
    }

    return true;
  });

  // Calculate analytics summary from all items
  const summary = {
    totalGenerations: filteredItems.length,
    byType: filteredItems.reduce((acc: Record<string, number>, item: any) => {
      acc[item.type] = (acc[item.type] || 0) + 1;
      return acc;
    }, {}),
  };

  const totalDocs = filteredItems.length;
  const thisMonthDocs = allItems.filter((item: any) => {
    // Parse timestamps - createdAt can be a string or number
    const timestamp = typeof item.createdAt === 'string'
      ? parseInt(item.createdAt, 10)
      : item.createdAt;
    if (isNaN(timestamp)) return false;
    const itemDate = new Date(timestamp);
    return itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear();
  }).length;

  // Calculate true weekly average based on actual usage period
  const calculateWeeklyAverage = () => {
    if (allItems.length === 0) return "0";

    // Parse timestamps - createdAt can be a string or number
    const dates = allItems.map((item: any) => {
      const timestamp = typeof item.createdAt === 'string'
        ? parseInt(item.createdAt, 10)
        : item.createdAt;
      return isNaN(timestamp) ? Date.now() : timestamp;
    });

    const oldestDate = Math.min(...dates);
    const newestDate = Math.max(...dates);
    const daysDiff = (newestDate - oldestDate) / (1000 * 60 * 60 * 24);
    const weeksDiff = Math.max(daysDiff / 7, 1);

    const avg = allItems.length / weeksDiff;
    return isNaN(avg) ? "0" : avg.toFixed(1);
  };

  const docTypes = Object.entries(summary.byType).sort((a, b) => b[1] - a[1]);
  const maxCount = Math.max(...Object.values(summary.byType as Record<string, number>), 1);
  const averagePerWeek = calculateWeeklyAverage();

  // Export to CSV functionality
  const handleExportCSV = () => {
    if (!filteredItems || filteredItems.length === 0) {
      toast({
        title: "No data to export",
        description: "Generate some documents first",
        variant: "destructive",
      });
      return;
    }

    const csvHeaders = ["Type", "Title", "Date", "Language"];
    const csvRows = filteredItems.map((item: any) => [
      typeLabels[item.type] || item.type,
      item.title || "Untitled",
      getDate(item.createdAt).toLocaleDateString(),
      item.language?.toUpperCase() || "N/A",
    ]);

    const csvContent = [
      csvHeaders.join(","),
      ...csvRows.map(row => row.map(cell => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `analytics-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Export successful",
      description: "Analytics data exported to CSV",
    });
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl" data-testid="page-analytics">
      <div className="mb-8">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Usage Analytics</h1>
            <p className="text-muted-foreground">
              Track your document generation history and usage patterns
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-[180px]" data-testid="filter-date-range">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={handleExportCSV}
              disabled={!filteredItems || filteredItems.length === 0}
              data-testid="button-export-csv"
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card data-testid="card-total-documents">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Documents</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{totalDocs}</div>
                <p className="text-xs text-muted-foreground">
                  All time generated documents
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-this-month">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{thisMonthDocs}</div>
                <p className="text-xs text-muted-foreground">
                  Documents this month
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-weekly-average">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Weekly Average</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{averagePerWeek}</div>
                <p className="text-xs text-muted-foreground">
                  Documents per week
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-most-used">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Most Used</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold capitalize">
                  {docTypes[0]?.[0] || "None"}
                </div>
                <p className="text-xs text-muted-foreground">
                  Most generated type
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Weekly activity trend */}
      <Card className="mb-6" data-testid="card-weekly-trend">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Weekly Activity (Last 7 Days)
          </CardTitle>
          <CardDescription>Number of documents generated each day</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-end gap-2 h-32">
              {[...Array(7)].map((_, i) => <Skeleton key={i} className="flex-1 rounded" style={{ height: `${30 + i * 10}%` }} />)}
            </div>
          ) : (() => {
            const days = Array.from({ length: 7 }, (_, i) => {
              const d = new Date(now);
              d.setDate(d.getDate() - (6 - i));
              return d;
            });
            const counts = days.map(day =>
              allItems.filter((item: any) => {
                const itemDate = getDate(item.createdAt);
                return itemDate.toDateString() === day.toDateString();
              }).length
            );
            const maxVal = Math.max(...counts, 1);
            const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
            return (
              <div className="flex items-end gap-2 h-32">
                {days.map((day, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className="text-xs font-medium text-muted-foreground">{counts[i] || ""}</div>
                    <div className="w-full flex items-end" style={{ height: "88px" }}>
                      <div
                        className="w-full rounded-t bg-primary transition-all duration-500"
                        style={{ height: `${(counts[i] / maxVal) * 100}%`, minHeight: counts[i] > 0 ? "4px" : "0" }}
                      />
                    </div>
                    <div className="text-xs text-muted-foreground">{dayLabels[day.getDay()]}</div>
                  </div>
                ))}
              </div>
            );
          })()}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card data-testid="card-by-type">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Documents by Type
            </CardTitle>
            <CardDescription>
              Breakdown of generated documents by category
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                ))}
              </div>
            ) : docTypes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No documents generated yet</p>
                <p className="text-sm">Start creating documents to see analytics</p>
              </div>
            ) : (
              <div className="space-y-6">
                {(["report", "powerpoint", "conference", "thesis", "image"] as const).map((type) => {
                  const count = (summary.byType as Record<string, number>)[type] || 0;
                  const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0;
                  const Icon = iconMap[type];

                  return (
                    <div key={type} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon className={`w-4 h-4 ${colorMap[type]}`} />
                          <span className="text-sm font-medium">{typeLabels[type]}</span>
                        </div>
                        <span className="text-sm text-muted-foreground">{count}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full ${bgColorMap[type]} transition-all duration-500`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-recent-activity">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Recent Activity
            </CardTitle>
            <CardDescription>
              Your latest document generations
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-3/4 mb-2" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : !filteredItems || filteredItems.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No recent activity</p>
                <p className="text-sm">Generate your first document to get started</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredItems.slice(0, 8).map((item: any) => {
                  const Icon = iconMap[item.type] || FileText;
                  const displayTitle = item.title?.length > 50 ? item.title.substring(0, 50) + '...' : item.title;

                  return (
                    <div key={item.id} className="flex items-center gap-4" data-testid={`activity-${item.id}`}>
                      <div className={`w-10 h-10 rounded-full ${colorMap[item.type]?.replace('text-', 'bg-').replace('-500', '-100')} dark:bg-opacity-20 flex items-center justify-center`}>
                        <Icon className={`w-5 h-5 ${colorMap[item.type]}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{displayTitle || 'Untitled'}</p>
                        <p className="text-xs text-muted-foreground">
                          {typeLabels[item.type]} • {getDate(item.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {item.language?.toUpperCase() || (item.type === "image" ? "IMG" : "EN")}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
