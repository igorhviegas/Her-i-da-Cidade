import React from 'react';
import {
  Ambulance, Anchor, AudioLines, Baby, Bell, Bike, Bomb, Book, BookOpen, Bookmark, Brain, Brush, Bug, Building2, Bus, Cake, Camera, Car, Cat,
  CalendarDays, Church, Clapperboard, Clock, Cloud, Coffee, Crosshair, Crown, Dice5, Dog, Drama, Dumbbell, Eye, Film, Flag, Flame, Flower2, Folder,
  Footprints, Gamepad2, Gem, Ghost, Gift, Globe, GraduationCap, Hammer, Hand, HandHeart, Handshake, Hash, Headphones, Heart, HeartHandshake,
  Hospital, Hourglass, IceCreamCone, Key, Landmark, Laugh, Layers, Leaf, Library, Lightbulb, ListVideo, Lock, MapPin, Medal, Megaphone,
  MessageCircleQuestionMark, MessageSquare, MessagesSquare, Mic, MonitorPlay, Moon, Mountain, Music, Newspaper, Palette, PartyPopper, PenLine, Pin,
  Pizza, Plane, Podcast, Popcorn, Puzzle, Quote, Radio, Rainbow, Repeat, Rocket, School, Scissors, Search, Shield, ShieldCheck, Shirt, Siren,
  Skull, Smile, Snowflake, Sparkles, Star, Stethoscope, Sun, Swords, Tag, Target, Tent, Theater, ThumbsUp, Ticket, TreePine, Trophy, Tv, User,
  Users, Utensils, Video, Volume2, Wand2, Waves, Wrench, Zap, type LucideIcon,
} from 'lucide-react';
import type { ScriptProject } from '../../../services/scriptProjects.js';

/**
 * Ícones disponíveis para projetos. Lista explícita (e não o pacote inteiro) para o painel não carregar
 * os milhares de ícones do lucide. Para oferecer mais um: importar e acrescentar aqui; o nome vai para o Firestore.
 */
export const PROJECT_ICONS: Record<string, LucideIcon> = {
  MessageCircleQuestionMark, MessageSquare, MessagesSquare, Quote, Megaphone, Mic, AudioLines, Podcast, Headphones, Volume2, Radio, Music,
  Video, Clapperboard, Film, Camera, Tv, MonitorPlay, ListVideo, Popcorn, Theater, Drama, Ticket, Repeat, Layers, CalendarDays, Clock, Hourglass,
  Sparkles, Star, Zap, Flame, Rocket, Wand2, Shield, ShieldCheck, Swords, Target, Crosshair, Trophy, Medal, Crown, Gem, Flag,
  Heart, HandHeart, HeartHandshake, Handshake, ThumbsUp, Smile, Laugh, PartyPopper, Gift, Cake, Baby, Users, User, Hand, Footprints, Eye,
  Lightbulb, Brain, Puzzle, BookOpen, Book, Library, GraduationCap, School, Newspaper, PenLine, Palette, Brush, Scissors, Search, Bookmark, Tag, Hash, Pin, Folder,
  Gamepad2, Dice5, Ghost, Skull, Bomb, Bug, Dog, Cat, TreePine, Leaf, Flower2, Sun, Moon, Cloud, Snowflake, Rainbow, Mountain, Waves, Anchor, Tent, Globe, MapPin,
  Car, Bike, Bus, Plane, Ambulance, Siren, Hospital, Stethoscope, Building2, Landmark, Church, Dumbbell, Shirt, Utensils, Coffee, Pizza, IceCreamCone, Wrench, Hammer, Key, Lock, Bell,
};

export const ProjectIcon: React.FC<{ icon: string | undefined; className?: string }> = ({ icon, className = 'h-4 w-4' }) => {
  const Icon = (icon && PROJECT_ICONS[icon]) || Folder;
  return <Icon className={className} aria-hidden />;
};

/** Selo do projeto nos cards e na lista de roteiros. */
export const ProjectBadge: React.FC<{ project: ScriptProject | undefined; className?: string }> = ({ project, className = '' }) => (
  project
    ? <span title={`Projeto: ${project.name}`} className={`inline-flex min-w-0 max-w-full items-center gap-1 rounded-full border border-fuchsia-400/25 bg-fuchsia-500/10 px-2 py-0.5 font-semibold text-fuchsia-100 ${className}`}><ProjectIcon icon={project.icon} className="h-3 w-3 shrink-0" /><span className="truncate">{project.name}</span></span>
    : <span className={`text-white/35 ${className}`}>Sem projeto</span>
);
