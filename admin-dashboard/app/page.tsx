'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Users, 
  FileText, 
  AlertTriangle, 
  Activity, 
  MessageSquare, 
  CreditCard,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  Download,
  Trash2,
  Eye,
  Phone,
  Hash,
  Calendar
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle, 
  AlertDialogTrigger 
} from '@/components/ui/alert-dialog';
import { toast } from '@/components/ui/use-toast';

// Types
interface Session {
  phoneNumber: string;
  threadId: string;
  action: string;
  agentType: string;
  interactions: number;
  payment: {
    transaction: {
      status: string;
    };
    linkSent: boolean;
  };
  lastActivity: string;
  sessionAge: number;
}

interface File {
  name: string;
  size: number;
  contentType: string;
  timeCreated: string;
  updated: string;
  publicUrl: string;
  threadId: string;
  fileName: string;
}

interface WhatsAppFailure {
  requestId: string;
  error: string;
  timestamp: string;
  phoneNumberId: string;
  retryable: boolean;
}

interface DashboardSummary {
  activeSessions: number;
  totalFiles: number;
  totalThreads: number;
  systemHealth: string;
  paymentStats: {
    successfulPayments: number;
    pendingPayments: number;
    totalInteractions: number;
  };
  whatsAppMetrics: {
    totalCalls: number;
    failedCalls: number;
    failureRate: string;
  };
}

export default function AdminDashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [failures, setFailures] = useState<WhatsAppFailure[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [conversationHistory, setConversationHistory] = useState<any[]>([]);

  const API_BASE = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8080';

  const fetchData = async () => {
    try {
      setLoading(true);
      const [summaryRes, sessionsRes, filesRes, failuresRes] = await Promise.all([
        fetch(`${API_BASE}/admin/dashboard`),
        fetch(`${API_BASE}/admin/sessions`),
        fetch(`${API_BASE}/admin/files`),
        fetch(`${API_BASE}/admin/whatsapp-failures`)
      ]);

      const summaryData = await summaryRes.json();
      const sessionsData = await sessionsRes.json();
      const filesData = await filesRes.json();
      const failuresData = await failuresRes.json();

      if (summaryData.success) setSummary(summaryData.data);
      if (sessionsData.success) setSessions(sessionsData.data);
      if (filesData.success) setFiles(filesData.data.files);
      if (failuresData.success) setFailures(failuresData.data.recentFailures || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to fetch dashboard data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchConversationHistory = async (phoneNumber: string) => {
    try {
      const response = await fetch(`${API_BASE}/admin/conversation/${phoneNumber}`);
      const data = await response.json();
      if (data.success) {
        setConversationHistory(data.data.conversation);
      }
    } catch (error) {
      console.error('Error fetching conversation:', error);
    }
  };

  const deleteSession = async (phoneNumber: string) => {
    try {
      const response = await fetch(`${API_BASE}/admin/sessions/${phoneNumber}`, {
        method: 'DELETE'
      });
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "Success",
          description: "Session deleted successfully"
        });
        fetchData(); // Refresh data
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to delete session",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error deleting session:', error);
      toast({
        title: "Error",
        description: "Failed to delete session",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - time.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'bg-green-500';
      case 'pending': return 'bg-yellow-500';
      case 'failed': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <RefreshCw className="h-8 w-8" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Equal Webhook Admin Dashboard</h1>
            <p className="text-gray-600 mt-2">Monitor sessions, files, and system health</p>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
            >
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{summary?.activeSessions || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    {summary?.paymentStats.successfulPayments || 0} paid sessions
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
            >
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Generated Files</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{summary?.totalFiles || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    Across {summary?.totalThreads || 0} threads
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
            >
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">System Health</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${
                      summary?.systemHealth === 'healthy' ? 'bg-green-500' : 'bg-red-500'
                    }`} />
                    <span className="text-sm font-medium capitalize">
                      {summary?.systemHealth || 'unknown'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {summary?.whatsAppMetrics.failureRate || '0'}% failure rate
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 }}
            >
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Interactions</CardTitle>
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{summary?.paymentStats.totalInteractions || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    {summary?.paymentStats.pendingPayments || 0} pending payments
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Main Content Tabs */}
          <Tabs defaultValue="sessions" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="sessions">Active Sessions</TabsTrigger>
              <TabsTrigger value="files">Generated Files</TabsTrigger>
              <TabsTrigger value="failures">WhatsApp Failures</TabsTrigger>
              <TabsTrigger value="health">System Health</TabsTrigger>
            </TabsList>

            {/* Sessions Tab */}
            <TabsContent value="sessions" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Active Sessions</CardTitle>
                  <CardDescription>
                    Monitor all active user sessions and their status
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Phone Number</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Agent Type</TableHead>
                        <TableHead>Interactions</TableHead>
                        <TableHead>Payment Status</TableHead>
                        <TableHead>Last Activity</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sessions.map((session) => (
                        <TableRow key={session.phoneNumber}>
                          <TableCell className="font-mono">{session.phoneNumber}</TableCell>
                          <TableCell>{session.action}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{session.agentType}</Badge>
                          </TableCell>
                          <TableCell>{session.interactions}</TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <div className={`w-2 h-2 rounded-full ${getStatusColor(session.payment?.transaction?.status)}`} />
                              <span className="text-sm capitalize">
                                {session.payment?.transaction?.status || 'unknown'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>{formatTimeAgo(session.lastActivity)}</TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedSession(session);
                                      fetchConversationHistory(session.phoneNumber);
                                    }}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-2xl">
                                  <DialogHeader>
                                    <DialogTitle>Session Details</DialogTitle>
                                    <DialogDescription>
                                      Phone: {session.phoneNumber}
                                    </DialogDescription>
                                  </DialogHeader>
                                  <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <label className="text-sm font-medium">Thread ID</label>
                                        <p className="text-sm text-muted-foreground font-mono">{session.threadId}</p>
                                      </div>
                                      <div>
                                        <label className="text-sm font-medium">Interactions</label>
                                        <p className="text-sm text-muted-foreground">{session.interactions}</p>
                                      </div>
                                    </div>
                                    <Separator />
                                    <div>
                                      <label className="text-sm font-medium">Conversation History</label>
                                      <div className="mt-2 space-y-2 max-h-60 overflow-y-auto">
                                        {conversationHistory.map((msg) => (
                                          <div
                                            key={msg.id}
                                            className={`p-2 rounded-lg ${
                                              msg.type === 'user' 
                                                ? 'bg-blue-50 ml-4' 
                                                : 'bg-gray-50 mr-4'
                                            }`}
                                          >
                                            <p className="text-sm">{msg.content}</p>
                                            <p className="text-xs text-muted-foreground mt-1">
                                              {formatTimeAgo(msg.timestamp)}
                                            </p>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                </DialogContent>
                              </Dialog>
                              
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="outline" size="sm">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Session</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete this session? This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteSession(session.phoneNumber)}
                                      className="bg-red-600 hover:bg-red-700"
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Files Tab */}
            <TabsContent value="files" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Generated Files</CardTitle>
                  <CardDescription>
                    All documents generated by the system
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>File Name</TableHead>
                        <TableHead>Thread ID</TableHead>
                        <TableHead>Size</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {files.map((file) => (
                        <TableRow key={file.name}>
                          <TableCell className="font-medium">{file.fileName}</TableCell>
                          <TableCell className="font-mono text-sm">{file.threadId}</TableCell>
                          <TableCell>{formatFileSize(file.size)}</TableCell>
                          <TableCell>{formatTimeAgo(file.timeCreated)}</TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(file.publicUrl, '_blank')}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Failures Tab */}
            <TabsContent value="failures" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>WhatsApp API Failures</CardTitle>
                  <CardDescription>
                    Recent WhatsApp API failures and errors
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {failures.length === 0 ? (
                    <Alert>
                      <CheckCircle className="h-4 w-4" />
                      <AlertDescription>
                        No recent WhatsApp API failures detected.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <div className="space-y-4">
                      {failures.map((failure, index) => (
                        <Alert key={index} variant="destructive">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription>
                            <div className="space-y-1">
                              <p className="font-medium">Request ID: {failure.requestId}</p>
                              <p className="text-sm">{failure.error}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatTimeAgo(failure.timestamp)} • {failure.phoneNumberId}
                              </p>
                            </div>
                          </AlertDescription>
                        </Alert>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Health Tab */}
            <TabsContent value="health" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>System Status</CardTitle>
                    <CardDescription>
                      Overall system health and component status
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Redis</span>
                        <Badge variant={summary?.systemHealth === 'healthy' ? 'default' : 'destructive'}>
                          {summary?.systemHealth === 'healthy' ? 'Healthy' : 'Unhealthy'}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Google Cloud Storage</span>
                        <Badge variant={summary?.systemHealth === 'healthy' ? 'default' : 'destructive'}>
                          {summary?.systemHealth === 'healthy' ? 'Healthy' : 'Unhealthy'}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">WhatsApp API</span>
                        <Badge variant={
                          parseFloat(summary?.whatsAppMetrics.failureRate || '0') < 10 
                            ? 'default' 
                            : 'destructive'
                        }>
                          {parseFloat(summary?.whatsAppMetrics.failureRate || '0') < 10 
                            ? 'Healthy' 
                            : 'Degraded'
                          }
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>WhatsApp API Metrics</CardTitle>
                    <CardDescription>
                      API call statistics and failure rates
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Total Calls</span>
                        <span className="text-sm">{summary?.whatsAppMetrics.totalCalls || 0}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Failed Calls</span>
                        <span className="text-sm text-red-600">
                          {summary?.whatsAppMetrics.failedCalls || 0}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Failure Rate</span>
                        <span className="text-sm">
                          {summary?.whatsAppMetrics.failureRate || '0'}%
                        </span>
                      </div>
                    </div>
                    <Progress 
                      value={parseFloat(summary?.whatsAppMetrics.failureRate || '0')} 
                      className="w-full"
                    />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </motion.div>
    </div>
  );
}
