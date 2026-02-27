/**
 * LLM Usage Analytics Page
 * Dashboard for monitoring and analyzing LLM API usage, costs, and performance
 * Admin-only access
 */

import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import {
  DollarSign,
  Zap,
  TrendingUp,
  Clock,
  Activity,
  AlertCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { llmAnalyticsService, type DailyUsage, type ModelUsage, type ActionUsage, type UserUsage } from '@/services/api/llm-analytics.service';
import { log, error as logError } from '@/lib/logger';

const COLORS = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#10b981', // green
  '#f59e0b', // amber
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
];

interface StatCard {
  label: string;
  value: string;
  icon: React.ElementType;
  trend?: string;
  color: string;
}

export function LLMUsageAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [dailyData, setDailyData] = useState<DailyUsage[]>([]);
  const [modelData, setModelData] = useState<ModelUsage[]>([]);
  const [actionData, setActionData] = useState<ActionUsage[]>([]);
  const [topUsers, setTopUsers] = useState<UserUsage[]>([]);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      const [daily, models, actions, users, overallStats] = await Promise.all([
        llmAnalyticsService.getDailyUsage(30),
        llmAnalyticsService.getModelUsage(),
        llmAnalyticsService.getActionUsage(),
        llmAnalyticsService.getTopUsers(10),
        llmAnalyticsService.getOverallStats(),
      ]);

      setDailyData(daily);
      setModelData(models);
      setActionData(actions);
      setTopUsers(users);
      setStats(overallStats);

      log('[LLM Analytics]', {
        daily: daily.length,
        models: models.length,
        actions: actions.length,
        users: users.length,
        stats: overallStats
      });
    } catch (err) {
      logError('[LLM Analytics] Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    }).format(value);
  };

  // Format number with commas
  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US').format(value);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-4">
          <div className="inline-block animate-spin">
            <Activity className="h-8 w-8" />
          </div>
          <p className="text-muted-foreground">Loading analytics...</p>
        </div>
      </div>
    );
  }

  const statCards: StatCard[] = [
    {
      label: 'Total Cost (All Time)',
      value: formatCurrency(stats?.total_cost || 0),
      icon: DollarSign,
      color: 'bg-blue-50 text-blue-700',
    },
    {
      label: 'This Month',
      value: formatCurrency(stats?.this_month_cost || 0),
      icon: TrendingUp,
      color: 'bg-green-50 text-green-700',
    },
    {
      label: 'Today',
      value: formatCurrency(stats?.today_cost || 0),
      icon: Zap,
      color: 'bg-amber-50 text-amber-700',
    },
    {
      label: 'Total Tokens',
      value: formatNumber(stats?.total_tokens || 0),
      icon: Activity,
      color: 'bg-purple-50 text-purple-700',
    },
    {
      label: 'Total Requests',
      value: formatNumber(stats?.total_requests || 0),
      icon: TrendingUp,
      color: 'bg-indigo-50 text-indigo-700',
    },
    {
      label: 'Avg Latency',
      value: `${stats?.average_latency_ms || 0}ms`,
      icon: Clock,
      color: 'bg-rose-50 text-rose-700',
    },
  ];

  return (
    <div className="space-y-8 p-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight">LLM Usage Analytics</h1>
        <p className="text-muted-foreground">
          Monitor and analyze LLM API usage, costs, and performance metrics
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                    <p className="text-2xl font-bold">{stat.value}</p>
                  </div>
                  <div className={`p-3 rounded-lg ${stat.color}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts Section */}
      <Tabs defaultValue="cost-trend" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="cost-trend">Cost Trend</TabsTrigger>
          <TabsTrigger value="models">Models</TabsTrigger>
          <TabsTrigger value="actions">Actions</TabsTrigger>
          <TabsTrigger value="users">Top Users</TabsTrigger>
        </TabsList>

        {/* Cost Trend Chart */}
        <TabsContent value="cost-trend" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Daily Cost Trend</CardTitle>
              <CardDescription>Cost breakdown over the last 30 days</CardDescription>
            </CardHeader>
            <CardContent>
              {dailyData.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={dailyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip formatter={(value) => formatCurrency(value as number)} />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="total_cost"
                      stroke="#3b82f6"
                      name="Daily Cost"
                      dot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>No data available</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Model Breakdown */}
        <TabsContent value="models" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Pie Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Cost by Model</CardTitle>
                <CardDescription>Distribution of costs across models</CardDescription>
              </CardHeader>
              <CardContent>
                {modelData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={modelData}
                        dataKey="total_cost"
                        nameKey="model"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label
                      >
                        {modelData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatCurrency(value as number)} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>No data available</AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* Bar Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Requests by Model</CardTitle>
                <CardDescription>Request count distribution</CardDescription>
              </CardHeader>
              <CardContent>
                {modelData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={modelData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="model" angle={-45} textAnchor="end" height={100} />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="total_requests" fill="#3b82f6" name="Requests" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>No data available</AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Model Details Table */}
          <Card>
            <CardHeader>
              <CardTitle>Model Details</CardTitle>
              <CardDescription>Complete breakdown of model usage</CardDescription>
            </CardHeader>
            <CardContent>
              {modelData.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Model</TableHead>
                      <TableHead className="text-right">Requests</TableHead>
                      <TableHead className="text-right">Tokens</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                      <TableHead className="text-right">Avg Cost/Req</TableHead>
                      <TableHead className="text-right">Avg Latency</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {modelData.map((model) => (
                      <TableRow key={model.model}>
                        <TableCell className="font-medium">{model.model}</TableCell>
                        <TableCell className="text-right">{formatNumber(model.total_requests)}</TableCell>
                        <TableCell className="text-right">{formatNumber(model.total_tokens)}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(model.total_cost)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(model.avg_cost_per_request)}
                        </TableCell>
                        <TableCell className="text-right">{Math.round(model.avg_latency_ms)}ms</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>No data available</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Action Breakdown */}
        <TabsContent value="actions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Cost by Action</CardTitle>
              <CardDescription>Breakdown of costs by operation type</CardDescription>
            </CardHeader>
            <CardContent>
              {actionData.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={actionData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="action" />
                    <YAxis />
                    <Tooltip formatter={(value) => formatCurrency(value as number)} />
                    <Legend />
                    <Bar dataKey="total_cost" fill="#10b981" name="Total Cost" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>No data available</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Action Details Table */}
          <Card>
            <CardHeader>
              <CardTitle>Action Details</CardTitle>
              <CardDescription>Complete breakdown by operation type</CardDescription>
            </CardHeader>
            <CardContent>
              {actionData.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Action</TableHead>
                      <TableHead className="text-right">Requests</TableHead>
                      <TableHead className="text-right">Tokens</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                      <TableHead className="text-right">Avg Cost/Req</TableHead>
                      <TableHead className="text-right">Avg Latency</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {actionData.map((action) => (
                      <TableRow key={action.action}>
                        <TableCell className="font-medium">{action.action}</TableCell>
                        <TableCell className="text-right">{formatNumber(action.total_requests)}</TableCell>
                        <TableCell className="text-right">{formatNumber(action.total_tokens)}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(action.total_cost)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(action.avg_cost_per_request)}
                        </TableCell>
                        <TableCell className="text-right">{Math.round(action.avg_latency_ms)}ms</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>No data available</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Top Users */}
        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top Users by Cost</CardTitle>
              <CardDescription>Users with highest LLM API usage costs</CardDescription>
            </CardHeader>
            <CardContent>
              {topUsers.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User ID</TableHead>
                      <TableHead className="text-right">Requests</TableHead>
                      <TableHead className="text-right">Tokens</TableHead>
                      <TableHead className="text-right">Total Cost</TableHead>
                      <TableHead className="text-right">Avg Cost/Req</TableHead>
                      <TableHead className="text-right">Last Used</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topUsers.map((user, index) => (
                      <TableRow key={user.user_id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-mono text-xs">
                              #{index + 1}
                            </Badge>
                            <span className="font-mono text-sm">{user.user_id.slice(0, 12)}...</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{formatNumber(user.total_requests)}</TableCell>
                        <TableCell className="text-right">{formatNumber(user.total_tokens)}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(user.total_cost)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(user.total_cost / user.total_requests)}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {new Date(user.last_usage).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>No user data available</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Refresh Button */}
      <div className="flex justify-end">
        <Button onClick={fetchAnalyticsData} variant="outline">
          Refresh Data
        </Button>
      </div>
    </div>
  );
}

export default LLMUsageAnalyticsPage;
