import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

export const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const success = await login(email, password);
    if (success) {
      toast.success('Login successful');
      navigate('/dashboard');
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#013333]">
      <Card className="w-full max-w-md bg-[#014D4D] border-[#14B8A6]/30 text-white shadow-2xl">
        <CardHeader className="text-center space-y-2">
          <CardTitle className="text-3xl font-bold text-[#5EEAD4]">AquaGen</CardTitle>
          <CardDescription className="text-[#94A3B8]">Advanced Aquaculture Management</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Input
                type="email"
                placeholder="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-[#013333] border-[#14B8A6]/30 text-white placeholder:text-slate-500"
                required
              />
            </div>
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-[#013333] border-[#14B8A6]/30 text-white placeholder:text-slate-500"
                required
              />
            </div>
            <Button type="submit" className="w-full bg-[#14B8A6] hover:bg-[#14B8A6]/80 text-[#013333] font-bold" disabled={isLoading}>
              {isLoading ? 'Connecting...' : 'Secure Login'}
            </Button>
          </form>
          
          <div className="mt-6 text-center text-sm text-[#94A3B8]">
            <p>Don't have an account?{' '}
              <Link to="/signup" className="text-[#5EEAD4] hover:underline font-medium">
                Request Access
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};