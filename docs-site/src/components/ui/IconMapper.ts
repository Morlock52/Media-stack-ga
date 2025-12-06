import {
    Activity, Box, Cloud, Database, Film, Globe,
    Layers, Lock, Server, Shield, Terminal, Tv,
    Zap, Cpu, HardDrive, Wifi, Radio, Command,
    Anchor, Archive, Bell, Bookmark, Calendar,
    Camera, Cast, Check, Clock, Code, Coffee,
    Compass, CreditCard, Crosshair, Disc,
    Download, Eye, File, Flag, Folder, Gift,
    Hash, Heart, Home, Image, Key, Link,
    List, Mail, Map, MessageCircle, Mic,
    Monitor, Moon, Music, Package, Phone,
    Play, Printer, Save, Search, Settings,
    Share, ShoppingBag, Smartphone, Speaker,
    Star, Sun, Tablet, Tag, ThumbsUp,
    Trash, Truck, Type, Unlock, Upload, User,
    Video, Voicemail, Watch, Wrench,
    // Added for App Registry compatibility
    MonitorPlay, BookOpen, UtensilsCrossed, Clapperboard,
    Inbox, ListVideo, Container, RefreshCw, Bug,
    ShieldCheck, FileVideo, Languages, Utensils
} from 'lucide-react'

const iconMap: Record<string, any> = {
    Activity, Box, Cloud, Database, Film, Globe,
    Layers, Lock, Server, Shield, Terminal, Tv,
    Zap, Cpu, HardDrive, Wifi, Radio, Command,
    Anchor, Archive, Bell, Bookmark, Calendar,
    Camera, Cast, Check, Clock, Code, Coffee,
    Compass, CreditCard, Crosshair, Disc,
    Download, Eye, File, Flag, Folder, Gift,
    Hash, Heart, Home, Image, Key, Link,
    List, Mail, Map, MessageCircle, Mic,
    Monitor, Moon, Music, Package, Phone,
    Play, Printer, Save, Search, Settings,
    Share, ShoppingBag, Smartphone, Speaker,
    Star, Sun, Tablet, Tag, ThumbsUp,
    Trash, Truck, Type, Unlock, Upload, User,
    Video, Voicemail, Watch, Wrench,
    // Added
    MonitorPlay, BookOpen, UtensilsCrossed, Clapperboard,
    Inbox, ListVideo, Container, RefreshCw, Bug,
    ShieldCheck, FileVideo, Languages, Utensils
}

export const getIconByName = (name: string | undefined) => {
    if (!name) return Box
    return iconMap[name] || Box
}
