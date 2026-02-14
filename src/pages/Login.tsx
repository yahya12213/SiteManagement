import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { HardHat, Truck, Users, ChevronLeft, ChevronRight, Eye, EyeOff } from 'lucide-react';

// Images thématiques de manutention et engins de chantier
const carouselImages = [
  {
    url: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?auto=format&fit=crop&w=1200&q=80',
    caption: 'Opérateur de chariot élévateur',
  },
  {
    url: 'https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?auto=format&fit=crop&w=1200&q=80',
    caption: 'Gestion des engins de chantier',
  },
  {
    url: 'https://images.unsplash.com/photo-1581092162384-8987c1d64718?auto=format&fit=crop&w=1200&q=80',
    caption: 'Manutention professionnelle',
  },
  {
    url: 'https://images.unsplash.com/photo-1513828583688-c52646db42da?auto=format&fit=crop&w=1200&q=80',
    caption: 'Équipe de travaux',
  },
];

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showPassword, setShowPassword] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  // Carousel automatique
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prevIndex) =>
        prevIndex === carouselImages.length - 1 ? 0 : prevIndex + 1
      );
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Pass rememberMe to login function
    // false = session cookie (expires when browser closes)
    // true = persistent (survives browser restart, but still has 40min inactivity timeout)
    const success = await login(username, password, rememberMe);

    if (success) {
      navigate('/dashboard');
    } else {
      setError('Nom d\'utilisateur ou mot de passe incorrect');
    }

    setLoading(false);
  };

  const goToPrevious = () => {
    setCurrentImageIndex((prevIndex) =>
      prevIndex === 0 ? carouselImages.length - 1 : prevIndex - 1
    );
  };

  const goToNext = () => {
    setCurrentImageIndex((prevIndex) =>
      prevIndex === carouselImages.length - 1 ? 0 : prevIndex + 1
    );
  };

  return (
    <div className="min-h-screen flex">
      {/* Panneau gauche - Carousel d'images */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-orange-600 to-blue-900 overflow-hidden">
        {/* Carousel */}
        <div className="relative w-full h-full">
          {carouselImages.map((image, index) => (
            <div
              key={index}
              className={`absolute inset-0 transition-opacity duration-1000 ${
                index === currentImageIndex ? 'opacity-100' : 'opacity-0'
              }`}
            >
              <img
                src={image.url}
                alt={image.caption}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent"></div>
            </div>
          ))}

          {/* Overlay avec informations */}
          <div className="absolute inset-0 flex flex-col justify-end p-12 text-white z-10">
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <HardHat className="w-12 h-12" />
                <h1 className="text-4xl font-bold">
                  Système de Gestion<br />Comptable
                </h1>
              </div>
              <p className="text-xl text-gray-200 max-w-md">
                Solution professionnelle pour la gestion des déclarations de sessions
              </p>
            </div>

            {/* Caption de l'image actuelle */}
            <div className="mb-4">
              <p className="text-lg font-medium text-gray-100">
                {carouselImages[currentImageIndex].caption}
              </p>
            </div>

            {/* Points indicateurs et navigation */}
            <div className="flex items-center gap-4">
              <button
                onClick={goToPrevious}
                className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors backdrop-blur-sm"
                aria-label="Image précédente"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <div className="flex gap-2">
                {carouselImages.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentImageIndex(index)}
                    className={`h-2 rounded-full transition-all ${
                      index === currentImageIndex
                        ? 'w-8 bg-white'
                        : 'w-2 bg-white/50 hover:bg-white/70'
                    }`}
                    aria-label={`Aller à l'image ${index + 1}`}
                  />
                ))}
              </div>

              <button
                onClick={goToNext}
                className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors backdrop-blur-sm"
                aria-label="Image suivante"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Badges fonctionnalités */}
            <div className="mt-8 flex flex-wrap gap-3">
              <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-white/10 backdrop-blur-sm">
                <Truck className="w-4 h-4" />
                <span className="text-sm font-medium">Engins de chantier</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-white/10 backdrop-blur-sm">
                <Users className="w-4 h-4" />
                <span className="text-sm font-medium">Gestion d'équipes</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-white/10 backdrop-blur-sm">
                <HardHat className="w-4 h-4" />
                <span className="text-sm font-medium">Manutention</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Panneau droit - Formulaire de connexion */}
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
        <div className="w-full max-w-md">
          {/* Logo mobile (visible uniquement sur petits écrans) */}
          <div className="lg:hidden mb-8 text-center">
            <div className="flex items-center justify-center gap-3 mb-3">
              <HardHat className="w-10 h-10 text-orange-600" />
              <h1 className="text-2xl font-bold text-gray-900">
                Gestion Comptable
              </h1>
            </div>
            <p className="text-gray-600">
              Solution pour vos déclarations de sessions
            </p>
          </div>

          <Card className="shadow-xl border-0">
            <CardHeader className="space-y-1 pb-6">
              <CardTitle className="text-2xl font-bold text-center text-gray-900">
                Connexion
              </CardTitle>
              <CardDescription className="text-center text-gray-600">
                Accédez à votre espace personnel
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <label htmlFor="username" className="text-sm font-medium text-gray-700">
                    Nom d'utilisateur
                  </label>
                  <Input
                    id="username"
                    type="text"
                    placeholder="Votre identifiant"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="password" className="text-sm font-medium text-gray-700">
                    Mot de passe
                  </label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Votre mot de passe"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="h-11 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
                      aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Remember Me checkbox */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="rememberMe"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
                  />
                  <label htmlFor="rememberMe" className="text-sm text-gray-600 cursor-pointer select-none">
                    Se souvenir de moi
                  </label>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm flex items-start gap-2">
                    <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <span>{error}</span>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full h-11 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 text-white font-medium shadow-lg"
                  disabled={loading}
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Connexion...
                    </span>
                  ) : (
                    'Se connecter'
                  )}
                </Button>
              </form>

              {/* Footer */}
              <div className="mt-6 pt-6 border-t border-gray-200 text-center text-sm text-gray-500">
                <p>© 2025 Système de Gestion Comptable</p>
                <p className="mt-1">Tous droits réservés</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Login;
