import { Link } from 'react-router-dom';
import { usePublicFormations, usePublicCities } from '@/hooks/useStudent';
import { studentApi } from '@/lib/api/student';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  GraduationCap,
  Users,
  Award,
  Trophy,
  Clock,
  Star,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Phone,
  Mail,
  MapPin,
  Menu,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
  Facebook,
  Linkedin,
  Youtube,
  Send,
  Shield,
  Truck,
  HardHat
} from 'lucide-react';

// ==================== Header Component ====================
const Header: React.FC = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setIsMobileMenuOpen(false);
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled
          ? 'bg-white/95 backdrop-blur-md shadow-lg'
          : 'bg-transparent'
        }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-violet-600 to-violet-800 rounded-lg flex items-center justify-center">
              <HardHat className="w-6 h-6 text-white" />
            </div>
            <span className={`text-xl font-bold font-montserrat ${isScrolled ? 'text-gray-900' : 'text-white'}`}>
              PROLEAN
            </span>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            <button
              onClick={() => scrollToSection('formations')}
              className={`text-sm font-medium transition-colors hover:text-violet-600 ${isScrolled ? 'text-gray-700' : 'text-white/90'
                }`}
            >
              Formations
            </button>
            <button
              onClick={() => scrollToSection('why-us')}
              className={`text-sm font-medium transition-colors hover:text-violet-600 ${isScrolled ? 'text-gray-700' : 'text-white/90'
                }`}
            >
              Pourquoi nous
            </button>
            <button
              onClick={() => scrollToSection('testimonials')}
              className={`text-sm font-medium transition-colors hover:text-violet-600 ${isScrolled ? 'text-gray-700' : 'text-white/90'
                }`}
            >
              Avis
            </button>
            <button
              onClick={() => scrollToSection('contact')}
              className={`text-sm font-medium transition-colors hover:text-violet-600 ${isScrolled ? 'text-gray-700' : 'text-white/90'
                }`}
            >
              Contact
            </button>
          </nav>

          {/* CTA Button */}
          <div className="hidden md:block">
            <Link to="/login">
              <Button className="bg-gradient-to-r from-violet-600 to-violet-700 hover:from-violet-700 hover:to-violet-800 text-white px-6 shadow-lg shadow-violet-500/30">
                Connexion
              </Button>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? (
              <X className={`w-6 h-6 ${isScrolled ? 'text-gray-900' : 'text-white'}`} />
            ) : (
              <Menu className={`w-6 h-6 ${isScrolled ? 'text-gray-900' : 'text-white'}`} />
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-white rounded-lg shadow-xl mt-2 p-4 absolute left-4 right-4">
            <nav className="flex flex-col gap-4">
              <button
                onClick={() => scrollToSection('formations')}
                className="text-left text-gray-700 hover:text-violet-600 py-2"
              >
                Formations
              </button>
              <button
                onClick={() => scrollToSection('why-us')}
                className="text-left text-gray-700 hover:text-violet-600 py-2"
              >
                Pourquoi nous
              </button>
              <button
                onClick={() => scrollToSection('testimonials')}
                className="text-left text-gray-700 hover:text-violet-600 py-2"
              >
                Avis
              </button>
              <button
                onClick={() => scrollToSection('contact')}
                className="text-left text-gray-700 hover:text-violet-600 py-2"
              >
                Contact
              </button>
              <Link to="/login" className="w-full">
                <Button className="w-full bg-gradient-to-r from-violet-600 to-violet-700 text-white">
                  Connexion
                </Button>
              </Link>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};

// ==================== Hero Section ====================
const HeroSection: React.FC = () => {
  const [showWelcome, setShowWelcome] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowWelcome(false), 8000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background Image with Overlay - Diverse professionals looking forward */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: 'url(/hero-background.png)'
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-violet-900/70 via-violet-800/50 to-violet-700/35"></div>
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="animate-fade-in-up">
          <span className="inline-block px-4 py-2 bg-violet-600/80 backdrop-blur-sm rounded-full text-white text-sm font-medium mb-6">
            12,000+ professionnels formes - 97% de reussite
          </span>

          <h1 className="text-4xl md:text-5xl lg:text-7xl font-bold text-white mb-6 font-montserrat leading-tight italic">
            Revolutionnez<br />
            Votre Carriere<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-orange-500 to-yellow-400">
              En 6 Mois<br />
              Seulement
            </span>
          </h1>

          <p className="text-lg md:text-xl text-white/90 max-w-2xl mx-auto mb-8">
            Rejoignez les 12,000+ professionnels qui ont transforme leur vie
            grace a nos formations ultra-pratiques. Des resultats concrets des
            le premier jour.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Button
              size="lg"
              className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-8 py-6 text-lg shadow-xl shadow-orange-500/30 rounded-full"
              onClick={() => document.getElementById('formations')?.scrollIntoView({ behavior: 'smooth' })}
            >
              <GraduationCap className="w-5 h-5 mr-2" />
              Decouvrir nos offres
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-2 border-white/30 bg-white/10 text-white hover:bg-white/20 px-8 py-6 text-lg backdrop-blur-sm rounded-full"
              onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Nous contacter
            </Button>
          </div>

          {/* Stats with separators */}
          <div className="flex flex-wrap justify-center items-center gap-4 md:gap-0">
            <div className="text-center px-6">
              <div className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-yellow-400">12,000+</div>
              <div className="text-white/70 text-sm">Etudiants</div>
            </div>
            <div className="hidden md:block h-12 w-px bg-white/30"></div>
            <div className="text-center px-6">
              <div className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-yellow-400">97%</div>
              <div className="text-white/70 text-sm">Taux de reussite</div>
            </div>
            <div className="hidden md:block h-12 w-px bg-white/30"></div>
            <div className="text-center px-6">
              <div className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-yellow-400">6 mois</div>
              <div className="text-white/70 text-sm">Formation max</div>
            </div>
          </div>
        </div>
      </div>

      {/* Welcome Toast */}
      {showWelcome && (
        <div className="fixed bottom-6 right-6 bg-white rounded-xl shadow-2xl p-4 max-w-sm animate-fade-in-up z-50">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center flex-shrink-0">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">Bienvenue chez PROLEAN !</p>
              <p className="text-sm text-gray-600">Decouvrez nos formations professionnelles de qualite.</p>
            </div>
            <button
              onClick={() => setShowWelcome(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <ChevronDown className="w-8 h-8 text-white/50" />
      </div>
    </section>
  );
};

// ==================== Promo Section ====================
const PromoSection: React.FC = () => {
  const [timeLeft, setTimeLeft] = useState({
    days: 14,
    hours: 8,
    minutes: 32,
    seconds: 15
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        let { days, hours, minutes, seconds } = prev;

        seconds--;
        if (seconds < 0) {
          seconds = 59;
          minutes--;
        }
        if (minutes < 0) {
          minutes = 59;
          hours--;
        }
        if (hours < 0) {
          hours = 23;
          days--;
        }
        if (days < 0) {
          days = 14;
          hours = 8;
          minutes = 32;
          seconds = 15;
        }

        return { days, hours, minutes, seconds };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <section className="relative py-8 bg-gradient-to-r from-orange-500 via-orange-600 to-red-500 overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-0 left-0 w-64 h-64 bg-white rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl"></div>
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-yellow-300 rounded-full translate-x-1/2 translate-y-1/2 blur-3xl"></div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <span className="text-3xl">&#128293;</span>
            <div>
              <p className="text-white font-bold text-lg md:text-xl">OFFRE LIMITEE</p>
              <p className="text-white/90">Economisez jusqu'a 30% sur nos formations</p>
            </div>
          </div>

          {/* Countdown */}
          <div className="flex items-center gap-3">
            <div className="text-center bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2">
              <div className="text-2xl font-bold text-white">{String(timeLeft.days).padStart(2, '0')}</div>
              <div className="text-xs text-white/80">Jours</div>
            </div>
            <span className="text-white text-2xl">:</span>
            <div className="text-center bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2">
              <div className="text-2xl font-bold text-white">{String(timeLeft.hours).padStart(2, '0')}</div>
              <div className="text-xs text-white/80">Heures</div>
            </div>
            <span className="text-white text-2xl">:</span>
            <div className="text-center bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2">
              <div className="text-2xl font-bold text-white">{String(timeLeft.minutes).padStart(2, '0')}</div>
              <div className="text-xs text-white/80">Min</div>
            </div>
            <span className="text-white text-2xl">:</span>
            <div className="text-center bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2">
              <div className="text-2xl font-bold text-white">{String(timeLeft.seconds).padStart(2, '0')}</div>
              <div className="text-xs text-white/80">Sec</div>
            </div>
          </div>

          <Button
            className="bg-white text-orange-600 hover:bg-gray-100 font-semibold px-6"
            onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })}
          >
            Profiter de l'offre
          </Button>
        </div>
      </div>
    </section>
  );
};

// ==================== Formations Section ====================

const FormationsSection: React.FC = () => {
  const { data: formations = [], isLoading } = usePublicFormations();

  return (
    <section id="formations" className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16">
          <span className="inline-block px-4 py-1 bg-violet-100 text-violet-700 rounded-full text-sm font-medium mb-4">
            Nos formations
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 font-montserrat">
            Formations Certifiantes
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Decouvrez nos formations CACES reconnues et certifiees.
            Formez-vous aux metiers de la manutention avec nos experts.
          </p>
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-12 h-12 text-violet-600 animate-spin" />
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {formations.map((formation: any) => (
              <Card
                key={formation.id}
                className="group overflow-hidden border-0 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2"
              >
                <div className="relative">
                  <img
                    src={formation.image || 'https://images.unsplash.com/photo-1581092162384-8987c1d64718?auto=format&fit=crop&w=600&q=80'}
                    alt={formation.title}
                    className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  {formation.is_featured && (
                    <span className="absolute top-4 left-4 px-3 py-1 bg-orange-500 text-white text-xs font-semibold rounded-full">
                      Populaire
                    </span>
                  )}
                </div>
                <CardContent className="p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-1">{formation.title}</h3>
                  <p className="text-gray-500 text-sm mb-4 line-clamp-2">{formation.description}</p>

                  <div className="flex items-center gap-4 mb-4 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      <span>{formation.duration_hours || 35}h</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                      <span>4.9</span>
                      <span className="text-gray-400">(24)</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-2xl font-bold text-violet-600">
                        {formation.price_mad ? formation.price_mad.toLocaleString() : 'Sur devis'}
                      </span>
                      {formation.price_mad && <span className="text-gray-500 text-sm"> DH</span>}
                    </div>
                    <Button
                      variant="outline"
                      className="border-violet-600 text-violet-600 hover:bg-violet-600 hover:text-white"
                      onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })}
                    >
                      S'inscrire
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* View All Button */}
        {!isLoading && formations.length > 0 && (
          <div className="text-center mt-12">
            <Button
              size="lg"
              className="bg-violet-600 hover:bg-violet-700 text-white px-8"
              onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Voir toutes les formations
            </Button>
          </div>
        )}
      </div>
    </section>
  );
};

// ==================== Why Choose Us Section ====================
const features = [
  {
    icon: GraduationCap,
    title: 'Formateurs Experts',
    description: 'Nos formateurs sont des professionnels certifies avec plus de 10 ans d\'experience',
    color: 'from-violet-500 to-violet-600'
  },
  {
    icon: Users,
    title: '5000+ Apprenants',
    description: 'Rejoignez une communaute de professionnels formes a nos methodes',
    color: 'from-blue-500 to-blue-600'
  },
  {
    icon: Award,
    title: 'Certifies CACES',
    description: 'Formations reconnues et certifications officielles delivrees',
    color: 'from-green-500 to-green-600'
  },
  {
    icon: Trophy,
    title: '98% de Reussite',
    description: 'Un taux de reussite exceptionnel grace a notre methode pedagogique',
    color: 'from-orange-500 to-orange-600'
  }
];

const WhyChooseUsSection: React.FC = () => {
  return (
    <section id="why-us" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16">
          <span className="inline-block px-4 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium mb-4">
            Nos avantages
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 font-montserrat">
            Pourquoi Choisir PROLEAN?
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Nous nous engageons a vous fournir la meilleure formation
            pour votre reussite professionnelle.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="text-center group"
            >
              <div className={`w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br ${feature.color} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                <feature.icon className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">{feature.title}</h3>
              <p className="text-gray-600 text-sm">{feature.description}</p>
            </div>
          ))}
        </div>

        {/* Additional Info */}
        <div className="mt-16 bg-gradient-to-r from-violet-600 to-indigo-600 rounded-3xl p-8 md:p-12 text-white">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <h3 className="text-2xl md:text-3xl font-bold mb-4 font-montserrat">
                Formation sur mesure pour votre entreprise
              </h3>
              <p className="text-white/80 mb-6">
                Nous proposons des formations adaptees aux besoins specifiques de votre entreprise.
                Nos experts se deplacent sur site pour former vos equipes.
              </p>
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-green-400" />
                  <span>Formation securite</span>
                </div>
                <div className="flex items-center gap-2">
                  <Truck className="w-5 h-5 text-green-400" />
                  <span>Equipements fournis</span>
                </div>
              </div>
            </div>
            <div className="text-center md:text-right">
              <Button
                size="lg"
                className="bg-white text-violet-600 hover:bg-gray-100 px-8"
                onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Demander un devis
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

// ==================== Testimonials Section ====================
const testimonials = [
  {
    id: 1,
    content: "Excellente formation! Les formateurs sont tres competents et a l'ecoute. J'ai obtenu mon CACES R489 du premier coup grace a leur methode pedagogique.",
    author: 'Ahmed B.',
    role: 'Operateur Cariste',
    company: 'Logistique Plus',
    rating: 5,
    avatar: 'AB'
  },
  {
    id: 2,
    content: "Formation complete et professionnelle. Le centre est bien equipe et les conditions sont ideales pour apprendre. Je recommande vivement!",
    author: 'Fatima Z.',
    role: 'Responsable Entrepot',
    company: 'Distribution Maroc',
    rating: 5,
    avatar: 'FZ'
  },
  {
    id: 3,
    content: "Grace a PROLEAN, j'ai pu evoluer dans ma carriere. La formation CACES R486 m'a ouvert de nouvelles opportunites professionnelles.",
    author: 'Mohamed K.',
    role: 'Chef d\'equipe',
    company: 'BTP Construction',
    rating: 5,
    avatar: 'MK'
  },
  {
    id: 4,
    content: "Service client impeccable et accompagnement personnalise. Une vraie equipe de professionnels qui vous prepare a reussir.",
    author: 'Sara L.',
    role: 'Conductrice d\'engins',
    company: 'Transport Express',
    rating: 5,
    avatar: 'SL'
  }
];

const TestimonialsSection: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const nextTestimonial = () => {
    setCurrentIndex((prev) => (prev + 1) % testimonials.length);
  };

  const prevTestimonial = () => {
    setCurrentIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  };

  useEffect(() => {
    const interval = setInterval(nextTestimonial, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section id="testimonials" className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16">
          <span className="inline-block px-4 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-medium mb-4">
            Temoignages
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 font-montserrat">
            Ce Que Disent Nos Apprenants
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Decouvrez les retours d'experience de nos apprenants qui ont
            transforme leur carriere grace a nos formations.
          </p>
        </div>

        {/* Testimonial Carousel */}
        <div className="relative max-w-4xl mx-auto">
          <Card className="border-0 shadow-xl bg-white overflow-hidden">
            <CardContent className="p-8 md:p-12">
              <div className="flex flex-col items-center text-center">
                {/* Avatar */}
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center text-white text-xl font-bold mb-6">
                  {testimonials[currentIndex].avatar}
                </div>

                {/* Rating */}
                <div className="flex gap-1 mb-6">
                  {[...Array(testimonials[currentIndex].rating)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                  ))}
                </div>

                {/* Quote */}
                <blockquote className="text-lg md:text-xl text-gray-700 mb-8 italic">
                  "{testimonials[currentIndex].content}"
                </blockquote>

                {/* Author */}
                <div>
                  <p className="font-bold text-gray-900">{testimonials[currentIndex].author}</p>
                  <p className="text-gray-500 text-sm">
                    {testimonials[currentIndex].role} - {testimonials[currentIndex].company}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Navigation Arrows */}
          <button
            onClick={prevTestimonial}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 md:-translate-x-12 w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center hover:bg-gray-50 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <button
            onClick={nextTestimonial}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 md:translate-x-12 w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center hover:bg-gray-50 transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>

          {/* Dots */}
          <div className="flex justify-center gap-2 mt-8">
            {testimonials.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={`w-3 h-3 rounded-full transition-all duration-300 ${index === currentIndex
                    ? 'bg-violet-600 w-8'
                    : 'bg-gray-300 hover:bg-gray-400'
                  }`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

// ==================== FAQ Section ====================
const faqs = [
  {
    question: 'Quels sont les prerequis pour les formations CACES?',
    answer: 'Pour suivre nos formations CACES, vous devez etre age de 18 ans minimum, comprendre le francais et etre apte medicalement (certificat medical d\'aptitude requis avant l\'examen). Aucune experience prealable n\'est necessaire.'
  },
  {
    question: 'Comment s\'inscrire a une formation?',
    answer: 'L\'inscription est simple: remplissez le formulaire de contact ou appelez-nous directement. Notre equipe vous recontactera sous 24h pour finaliser votre inscription et vous communiquer les dates disponibles.'
  },
  {
    question: 'Quelle est la duree de validite des CACES?',
    answer: 'Les CACES ont une duree de validite de 5 ans pour la plupart des categories (R489, R486, R482). Apres cette periode, une formation de recyclage et un nouvel examen sont necessaires pour renouveler votre certification.'
  },
  {
    question: 'Proposez-vous des formations en entreprise?',
    answer: 'Oui, nous proposons des formations intra-entreprise. Nos formateurs se deplacent sur votre site avec le materiel necessaire. C\'est une solution ideale pour former plusieurs employes simultanement.'
  },
  {
    question: 'Quels modes de paiement acceptez-vous?',
    answer: 'Nous acceptons les paiements par virement bancaire, cheque et especes. Pour les entreprises, nous proposons la facturation directe. Des facilites de paiement peuvent etre envisagees selon les cas.'
  }
];

const FAQSection: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="py-20 bg-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16">
          <span className="inline-block px-4 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium mb-4">
            FAQ
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 font-montserrat">
            Questions Frequentes
          </h2>
          <p className="text-gray-600">
            Retrouvez les reponses aux questions les plus posees par nos apprenants.
          </p>
        </div>

        {/* FAQ Accordion */}
        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="border border-gray-200 rounded-xl overflow-hidden"
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full flex items-center justify-between p-6 text-left bg-white hover:bg-gray-50 transition-colors"
              >
                <span className="font-semibold text-gray-900">{faq.question}</span>
                <ChevronDown
                  className={`w-5 h-5 text-gray-500 transition-transform duration-300 ${openIndex === index ? 'rotate-180' : ''
                    }`}
                />
              </button>
              <div
                className={`overflow-hidden transition-all duration-300 ${openIndex === index ? 'max-h-96' : 'max-h-0'
                  }`}
              >
                <div className="p-6 pt-0 text-gray-600">
                  {faq.answer}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ==================== Certificate Verification Section ====================
const CertificateVerificationSection: React.FC = () => {
  const [certificateNumber, setCertificateNumber] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleVerify = () => {
    if (!certificateNumber.trim()) return;

    setStatus('loading');
    // Simulate verification
    setTimeout(() => {
      if (certificateNumber.toLowerCase().startsWith('caces')) {
        setStatus('success');
      } else {
        setStatus('error');
      }
    }, 1500);
  };

  return (
    <section className="py-16 bg-gradient-to-r from-gray-900 to-gray-800">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Shield className="w-8 h-8 text-green-400" />
          <h2 className="text-2xl md:text-3xl font-bold text-white font-montserrat">
            Verifier un Certificat
          </h2>
        </div>
        <p className="text-gray-400 mb-8">
          Entrez le numero de certificat pour verifier son authenticite
        </p>

        <div className="flex flex-col sm:flex-row gap-4 max-w-xl mx-auto">
          <Input
            placeholder="Ex: CACES-2024-XXXXX"
            value={certificateNumber}
            onChange={(e) => {
              setCertificateNumber(e.target.value);
              setStatus('idle');
            }}
            className="flex-1 h-12 bg-white/10 border-white/20 text-white placeholder:text-gray-400"
          />
          <Button
            onClick={handleVerify}
            disabled={status === 'loading'}
            className="h-12 px-8 bg-green-500 hover:bg-green-600 text-white"
          >
            {status === 'loading' ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              'Verifier'
            )}
          </Button>
        </div>

        {/* Status Messages */}
        {status === 'success' && (
          <div className="mt-6 flex items-center justify-center gap-2 text-green-400">
            <CheckCircle className="w-5 h-5" />
            <span>Certificat valide et authentique</span>
          </div>
        )}
        {status === 'error' && (
          <div className="mt-6 flex items-center justify-center gap-2 text-red-400">
            <AlertCircle className="w-5 h-5" />
            <span>Certificat non trouve. Verifiez le numero.</span>
          </div>
        )}
      </div>
    </section>
  );
};

// ==================== Contact Section ====================
const ContactSection: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await studentApi.submitContactRequest({
        full_name: formData.name,
        email: formData.email,
        phone: formData.phone,
        message: formData.message,
        city: 'Casablanca', // Default or add field
        request_type: 'information'
      });

      setIsSubmitting(false);
      setIsSubmitted(true);
      setFormData({ name: '', email: '', phone: '', message: '' });

      // Reset success message after 5 seconds
      setTimeout(() => setIsSubmitted(false), 5000);
    } catch (error) {
      console.error('Contact submission failed:', error);
      setIsSubmitting(false);
      alert('Une erreur est survenue lors de l\'envoi du message. Veuillez réessayer.');
    }
  };

  return (
    <section id="contact" className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16">
          <span className="inline-block px-4 py-1 bg-violet-100 text-violet-700 rounded-full text-sm font-medium mb-4">
            Contact
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 font-montserrat">
            Contactez-Nous
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Une question? Un projet de formation? Notre equipe est a votre disposition.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12">
          {/* Contact Info */}
          <div>
            <h3 className="text-xl font-bold text-gray-900 mb-6">Nos coordonnees</h3>

            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-6 h-6 text-violet-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">Adresse</h4>
                  <p className="text-gray-600">123 Boulevard Mohammed V<br />Casablanca, Maroc</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
                  <Phone className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">Telephone</h4>
                  <p className="text-gray-600">+212 5 22 XX XX XX</p>
                  <p className="text-gray-600">+212 6 XX XX XX XX</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <Mail className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">Email</h4>
                  <p className="text-gray-600">contact@prolean.ma</p>
                  <p className="text-gray-600">formation@prolean.ma</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
                  <Clock className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">Horaires</h4>
                  <p className="text-gray-600">Lundi - Vendredi: 8h00 - 18h00</p>
                  <p className="text-gray-600">Samedi: 9h00 - 13h00</p>
                </div>
              </div>
            </div>

            {/* Social Links */}
            <div className="mt-8">
              <h4 className="font-semibold text-gray-900 mb-4">Suivez-nous</h4>
              <div className="flex gap-4">
                <a href="#" className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white hover:bg-blue-700 transition-colors">
                  <Facebook className="w-5 h-5" />
                </a>
                <a href="#" className="w-10 h-10 rounded-full bg-blue-700 flex items-center justify-center text-white hover:bg-blue-800 transition-colors">
                  <Linkedin className="w-5 h-5" />
                </a>
                <a href="#" className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center text-white hover:bg-red-700 transition-colors">
                  <Youtube className="w-5 h-5" />
                </a>
              </div>
            </div>
          </div>

          {/* Contact Form */}
          <Card className="border-0 shadow-xl">
            <CardContent className="p-8">
              <h3 className="text-xl font-bold text-gray-900 mb-6">Envoyez-nous un message</h3>

              {isSubmitted ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  </div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">Message envoye!</h4>
                  <p className="text-gray-600">Nous vous repondrons dans les plus brefs delais.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nom complet
                    </label>
                    <Input
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Votre nom"
                      className="h-12"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email
                    </label>
                    <Input
                      required
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="votre@email.com"
                      className="h-12"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Telephone
                    </label>
                    <Input
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+212 6 XX XX XX XX"
                      className="h-12"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Message
                    </label>
                    <textarea
                      required
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      placeholder="Comment pouvons-nous vous aider?"
                      rows={4}
                      className="w-full rounded-md border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full h-12 bg-violet-600 hover:bg-violet-700 text-white"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Send className="w-5 h-5 mr-2" />
                        Envoyer le message
                      </>
                    )}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
};

// ==================== Footer ====================
const Footer: React.FC = () => {
  return (
    <footer className="bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* Company Info */}
          <div>
            <div className="flex items-center gap-2 mb-6">
              <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-violet-700 rounded-lg flex items-center justify-center">
                <HardHat className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold">PROLEAN</span>
            </div>
            <p className="text-gray-400 text-sm mb-6">
              Centre de formation professionnelle specialise dans la manutention
              et la conduite d'engins. Certifications CACES reconnues.
            </p>
            <div className="flex gap-4">
              <a href="#" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
                <Facebook className="w-5 h-5" />
              </a>
              <a href="#" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
                <Linkedin className="w-5 h-5" />
              </a>
              <a href="#" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
                <Youtube className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Formations */}
          <div>
            <h3 className="text-lg font-semibold mb-6">Formations</h3>
            <ul className="space-y-3">
              <li><a href="#" className="text-gray-400 hover:text-white transition-colors">CACES R489 - Chariots</a></li>
              <li><a href="#" className="text-gray-400 hover:text-white transition-colors">CACES R486 - PEMP</a></li>
              <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Pont Roulant</a></li>
              <li><a href="#" className="text-gray-400 hover:text-white transition-colors">CACES R482 - Engins</a></li>
              <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Formation Securite</a></li>
            </ul>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-lg font-semibold mb-6">Liens utiles</h3>
            <ul className="space-y-3">
              <li><a href="#" className="text-gray-400 hover:text-white transition-colors">A propos</a></li>
              <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Nos formateurs</a></li>
              <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Financement</a></li>
              <li><a href="#" className="text-gray-400 hover:text-white transition-colors">FAQ</a></li>
              <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Contact</a></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-lg font-semibold mb-6">Contact</h3>
            <ul className="space-y-3 text-gray-400">
              <li className="flex items-start gap-3">
                <MapPin className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <span>123 Boulevard Mohammed V, Casablanca</span>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="w-5 h-5 flex-shrink-0" />
                <span>+212 5 22 XX XX XX</span>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="w-5 h-5 flex-shrink-0" />
                <span>contact@prolean.ma</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-gray-400 text-sm">
              &copy; 2025 PROLEAN. Tous droits reserves.
            </p>
            <div className="flex gap-6 text-sm">
              <a href="#" className="text-gray-400 hover:text-white transition-colors">Mentions legales</a>
              <a href="#" className="text-gray-400 hover:text-white transition-colors">CGU</a>
              <a href="#" className="text-gray-400 hover:text-white transition-colors">Politique de confidentialite</a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

// ==================== Main Landing Page Component ====================
const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <HeroSection />
        <PromoSection />
        <FormationsSection />
        <WhyChooseUsSection />
        <TestimonialsSection />
        <FAQSection />
        <CertificateVerificationSection />
        <ContactSection />
      </main>
      <Footer />
    </div>
  );
};

export default LandingPage;
