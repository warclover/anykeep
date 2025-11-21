import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { mockCollections, platformNames, folders } from '../utils/mockData';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { TrendingUp, Folder, Tag, Calendar } from 'lucide-react';

export function Statistics() {
  // Platform distribution
  const platformData = Object.entries(
    mockCollections.reduce((acc, c) => {
      acc[c.platform] = (acc[c.platform] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([platform, count]) => ({
    name: platformNames[platform as keyof typeof platformNames],
    value: count,
  }));

  // Content type distribution
  const typeData = [
    { name: '文章', value: mockCollections.filter(c => c.type === 'article').length },
    { name: '视频', value: mockCollections.filter(c => c.type === 'video').length },
    { name: '图片', value: mockCollections.filter(c => c.type === 'image').length },
  ].filter(d => d.value > 0);

  // Tag frequency
  const allTags = mockCollections.flatMap(c => c.tags);
  const tagFrequency = Object.entries(
    allTags.reduce((acc, tag) => {
      acc[tag] = (acc[tag] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  )
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Monthly trend (mock data)
  const monthlyData = [
    { month: '10月', count: 45 },
    { month: '11月', count: 62 },
    { month: '12月', count: 78 },
    { month: '1月', count: 68 },
  ];

  const COLORS = ['#8b5cf6', '#ec4899', '#3b82f6', '#10b981', '#f59e0b'];

  return (
    <div className="h-full overflow-auto">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 md:px-8 py-4 md:py-6">
        <h2 className="text-gray-900 dark:text-white">数据统计</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">了解你的收藏习惯和内容分布</p>
      </header>

      {/* Stats Overview */}
      <div className="px-4 md:px-8 py-4 md:py-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6 mb-6 md:mb-8">
          <Card>
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 dark:text-gray-400 text-xs md:text-sm mb-1">总收藏数</p>
                  <p className="text-gray-900 dark:text-white text-xl md:text-2xl">{mockCollections.length}</p>
                </div>
                <TrendingUp className="size-6 md:size-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 dark:text-gray-400 text-xs md:text-sm mb-1">文件夹数</p>
                  <p className="text-gray-900 dark:text-white text-xl md:text-2xl">{folders.length}</p>
                </div>
                <Folder className="size-6 md:size-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 dark:text-gray-400 text-xs md:text-sm mb-1">标签数</p>
                  <p className="text-gray-900 dark:text-white text-xl md:text-2xl">{tagFrequency.length}</p>
                </div>
                <Tag className="size-6 md:size-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 dark:text-gray-400 text-xs md:text-sm mb-1">本月新增</p>
                  <p className="text-gray-900 dark:text-white text-xl md:text-2xl">68</p>
                </div>
                <Calendar className="size-6 md:size-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 mb-4 md:mb-6">
          {/* Platform Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base md:text-lg">平台分布</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={platformData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={70}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {platformData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Content Type Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base md:text-lg">内容类型分布</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={typeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#8b5cf6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Monthly Trend */}
        <Card className="mb-4 md:mb-6">
          <CardHeader>
            <CardTitle className="text-base md:text-lg">收藏趋势</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#8b5cf6" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Tags */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base md:text-lg">热门标签 TOP 10</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={tagFrequency} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="tag" type="category" width={80} />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}