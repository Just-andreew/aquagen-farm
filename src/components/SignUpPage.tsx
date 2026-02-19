import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

export const SignUpPage = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { signup, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
        toast.error('Password must be at least 6 characters.');
        return;
    }

    setIsLoading(true);
    const success = await signup(email, password, name);
    if (success) {
      toast.success('Account created successfully');
      navigate('/dashboard');
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#013333]">
      <Card className="w-full max-w-md bg-[#014D4D] border-[#14B8A6]/30 text-white shadow-2xl">
        <CardHeader className="text-center space-y-2">
          <CardTitle className="text-3xl font-bold text-[#5EEAD4]">Join AquaGen</CardTitle>
          <CardDescription className="text-[#94A3B8]">Register for farm access</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Input
                type="text"
                placeholder="Full Name (e.g. Peter Kamau)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-[#013333] border-[#14B8A6]/30 text-white placeholder:text-slate-500"
                required
              />
            </div>
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
                placeholder="Password (min. 6 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-[#013333] border-[#14B8A6]/30 text-white placeholder:text-slate-500"
                required
              />
            </div>
            <Button type="submit" className="w-full bg-[#14B8A6] hover:bg-[#14B8A6]/80 text-[#013333] font-bold" disabled={isLoading}>
              {isLoading ? 'Creating Account...' : 'Sign Up'}
            </Button>
          </form>
          
          <div className="mt-6 text-center text-sm text-[#94A3B8]">
            <p>Already have an account?{' '}
              <Link to="/login" className="text-[#5EEAD4] hover:underline font-medium">
                Log In
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};