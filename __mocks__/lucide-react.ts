/**
 * Mock for lucide-react icons
 * Used in Jest tests to avoid ESM module issues
 */

import * as React from "react";

// Create a generic mock icon component
const createMockIcon = (displayName: string) => {
  const Icon = React.forwardRef<SVGSVGElement, React.SVGProps<SVGSVGElement>>(
    (props, ref) =>
      React.createElement("svg", {
        ...props,
        ref,
        "data-testid": `icon-${displayName}`,
      }),
  );
  Icon.displayName = displayName;
  return Icon;
};

// Export commonly used icons as mocks
export const MessageSquare = createMockIcon("MessageSquare");
export const Chrome = createMockIcon("Chrome");
export const Globe = createMockIcon("Globe");
export const Bookmark = createMockIcon("Bookmark");
export const Folder = createMockIcon("Folder");
export const Tag = createMockIcon("Tag");
export const TrendingUp = createMockIcon("TrendingUp");
export const TrendingDown = createMockIcon("TrendingDown");
export const Calendar = createMockIcon("Calendar");
export const Users = createMockIcon("Users");
export const Download = createMockIcon("Download");
export const Sparkles = createMockIcon("Sparkles");
export const ArrowUpRight = createMockIcon("ArrowUpRight");
export const ArrowDownRight = createMockIcon("ArrowDownRight");
export const Minus = createMockIcon("Minus");
export const FolderOpen = createMockIcon("FolderOpen");
export const Search = createMockIcon("Search");
export const Settings = createMockIcon("Settings");
export const Home = createMockIcon("Home");
export const Menu = createMockIcon("Menu");
export const X = createMockIcon("X");
export const Check = createMockIcon("Check");
export const ChevronRight = createMockIcon("ChevronRight");
export const ChevronLeft = createMockIcon("ChevronLeft");
export const ChevronDown = createMockIcon("ChevronDown");
export const ChevronUp = createMockIcon("ChevronUp");
export const MoreHorizontal = createMockIcon("MoreHorizontal");
export const MoreVertical = createMockIcon("MoreVertical");
export const Plus = createMockIcon("Plus");
export const Trash = createMockIcon("Trash");
export const Edit = createMockIcon("Edit");
export const Copy = createMockIcon("Copy");
export const Link = createMockIcon("Link");
export const ExternalLink = createMockIcon("ExternalLink");
export const Eye = createMockIcon("Eye");
export const EyeOff = createMockIcon("EyeOff");
export const AlertCircle = createMockIcon("AlertCircle");
export const AlertTriangle = createMockIcon("AlertTriangle");
export const Info = createMockIcon("Info");
export const HelpCircle = createMockIcon("HelpCircle");
export const Loader2 = createMockIcon("Loader2");
export const RefreshCw = createMockIcon("RefreshCw");
export const RotateCcw = createMockIcon("RotateCcw");
export const Star = createMockIcon("Star");
export const Heart = createMockIcon("Heart");
export const Share = createMockIcon("Share");
export const Filter = createMockIcon("Filter");
export const SortAsc = createMockIcon("SortAsc");
export const SortDesc = createMockIcon("SortDesc");
export const Grid = createMockIcon("Grid");
export const List = createMockIcon("List");
export const Layout = createMockIcon("Layout");
export const FileText = createMockIcon("FileText");
export const Image = createMockIcon("Image");
export const Video = createMockIcon("Video");
export const Music = createMockIcon("Music");
export const File = createMockIcon("File");
export const Upload = createMockIcon("Upload");
export const Clock = createMockIcon("Clock");
export const Bell = createMockIcon("Bell");
export const Mail = createMockIcon("Mail");
export const User = createMockIcon("User");
export const LogOut = createMockIcon("LogOut");
export const LogIn = createMockIcon("LogIn");
export const Lock = createMockIcon("Lock");
export const Unlock = createMockIcon("Unlock");
export const Key = createMockIcon("Key");
export const Shield = createMockIcon("Shield");
export const Zap = createMockIcon("Zap");
export const Activity = createMockIcon("Activity");
export const BarChart = createMockIcon("BarChart");
export const PieChart = createMockIcon("PieChart");
export const LineChart = createMockIcon("LineChart");
export const Database = createMockIcon("Database");
export const Server = createMockIcon("Server");
export const Cloud = createMockIcon("Cloud");
export const Wifi = createMockIcon("Wifi");
export const WifiOff = createMockIcon("WifiOff");
export const Moon = createMockIcon("Moon");
export const Sun = createMockIcon("Sun");
export const Monitor = createMockIcon("Monitor");
export const Smartphone = createMockIcon("Smartphone");
export const Tablet = createMockIcon("Tablet");
export const Laptop = createMockIcon("Laptop");
export const LayoutGrid = createMockIcon("LayoutGrid");
export const PanelLeftClose = createMockIcon("PanelLeftClose");
export const PanelLeft = createMockIcon("PanelLeft");
export const LayoutDashboard = createMockIcon("LayoutDashboard");
export const ChartLine = createMockIcon("ChartLine");
export const Package = createMockIcon("Package");
export const Boxes = createMockIcon("Boxes");
export const ArrowLeft = createMockIcon("ArrowLeft");
export const ArrowRight = createMockIcon("ArrowRight");

// Default export for dynamic imports
const icons = {
  MessageSquare,
  Chrome,
  Globe,
  Bookmark,
  Folder,
  Tag,
  TrendingUp,
  TrendingDown,
  Calendar,
  Users,
  Download,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  FolderOpen,
};

export default icons;
