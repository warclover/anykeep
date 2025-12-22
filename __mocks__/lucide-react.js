/**
 * Mock for lucide-react icons
 * Used in Jest tests to avoid ESM module issues
 */

const React = require("react");

// Debug: log when mock is loaded
// console.log("[lucide-react mock] Mock file loaded");

// Create a generic mock icon component
function createMockIcon(displayName) {
  function Icon(props) {
    return React.createElement("svg", {
      ...props,
      "data-testid": `icon-${displayName}`,
    });
  }
  Icon.displayName = displayName;
  return Icon;
}

// Export commonly used icons as mocks
// Use Object.defineProperty to ensure ES module compatibility
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageSquare = createMockIcon("MessageSquare");
exports.Chrome = createMockIcon("Chrome");
exports.Globe = createMockIcon("Globe");
exports.Bookmark = createMockIcon("Bookmark");
exports.Folder = createMockIcon("Folder");
exports.Tag = createMockIcon("Tag");
exports.TrendingUp = createMockIcon("TrendingUp");
exports.TrendingDown = createMockIcon("TrendingDown");
exports.Calendar = createMockIcon("Calendar");
exports.Users = createMockIcon("Users");
exports.Download = createMockIcon("Download");
exports.Sparkles = createMockIcon("Sparkles");
exports.ArrowUpRight = createMockIcon("ArrowUpRight");
exports.ArrowDownRight = createMockIcon("ArrowDownRight");
exports.Minus = createMockIcon("Minus");
exports.FolderOpen = createMockIcon("FolderOpen");
exports.Search = createMockIcon("Search");
exports.Settings = createMockIcon("Settings");
exports.Home = createMockIcon("Home");
exports.Menu = createMockIcon("Menu");
exports.X = createMockIcon("X");
exports.XIcon = createMockIcon("XIcon");
exports.Check = createMockIcon("Check");
exports.ChevronRight = createMockIcon("ChevronRight");
exports.ChevronLeft = createMockIcon("ChevronLeft");
exports.ChevronDown = createMockIcon("ChevronDown");
exports.ChevronUp = createMockIcon("ChevronUp");
exports.MoreHorizontal = createMockIcon("MoreHorizontal");
exports.MoreVertical = createMockIcon("MoreVertical");
exports.Plus = createMockIcon("Plus");
exports.Trash = createMockIcon("Trash");
exports.Edit = createMockIcon("Edit");
exports.Copy = createMockIcon("Copy");
exports.Link = createMockIcon("Link");
exports.ExternalLink = createMockIcon("ExternalLink");
exports.Eye = createMockIcon("Eye");
exports.EyeOff = createMockIcon("EyeOff");
exports.AlertCircle = createMockIcon("AlertCircle");
exports.AlertTriangle = createMockIcon("AlertTriangle");
exports.Info = createMockIcon("Info");
exports.HelpCircle = createMockIcon("HelpCircle");
exports.Loader2 = createMockIcon("Loader2");
exports.RefreshCw = createMockIcon("RefreshCw");
exports.RotateCcw = createMockIcon("RotateCcw");
exports.Star = createMockIcon("Star");
exports.Heart = createMockIcon("Heart");
exports.Share = createMockIcon("Share");
exports.Filter = createMockIcon("Filter");
exports.SortAsc = createMockIcon("SortAsc");
exports.SortDesc = createMockIcon("SortDesc");
exports.Grid = createMockIcon("Grid");
exports.List = createMockIcon("List");
exports.Layout = createMockIcon("Layout");
exports.FileText = createMockIcon("FileText");
exports.Image = createMockIcon("Image");
exports.Video = createMockIcon("Video");
exports.Music = createMockIcon("Music");
exports.File = createMockIcon("File");
exports.Upload = createMockIcon("Upload");
exports.Clock = createMockIcon("Clock");
exports.Bell = createMockIcon("Bell");
exports.Mail = createMockIcon("Mail");
exports.User = createMockIcon("User");
exports.LogOut = createMockIcon("LogOut");
exports.LogIn = createMockIcon("LogIn");
exports.Lock = createMockIcon("Lock");
exports.Unlock = createMockIcon("Unlock");
exports.Key = createMockIcon("Key");
exports.Shield = createMockIcon("Shield");
exports.Zap = createMockIcon("Zap");
exports.Activity = createMockIcon("Activity");
exports.BarChart = createMockIcon("BarChart");
exports.PieChart = createMockIcon("PieChart");
exports.LineChart = createMockIcon("LineChart");
exports.Database = createMockIcon("Database");
exports.Server = createMockIcon("Server");
exports.Cloud = createMockIcon("Cloud");
exports.Wifi = createMockIcon("Wifi");
exports.WifiOff = createMockIcon("WifiOff");
exports.Moon = createMockIcon("Moon");
exports.Sun = createMockIcon("Sun");
exports.Monitor = createMockIcon("Monitor");
exports.Smartphone = createMockIcon("Smartphone");
exports.Tablet = createMockIcon("Tablet");
exports.Laptop = createMockIcon("Laptop");
exports.LayoutGrid = createMockIcon("LayoutGrid");
exports.PanelLeftClose = createMockIcon("PanelLeftClose");
exports.PanelLeft = createMockIcon("PanelLeft");
exports.LayoutDashboard = createMockIcon("LayoutDashboard");
exports.ChartLine = createMockIcon("ChartLine");
exports.Package = createMockIcon("Package");
exports.Boxes = createMockIcon("Boxes");
exports.ArrowLeft = createMockIcon("ArrowLeft");
exports.ArrowRight = createMockIcon("ArrowRight");

// AI Components icons
exports.FileText = createMockIcon("FileText");
exports.Edit2 = createMockIcon("Edit2");
exports.CheckCheck = createMockIcon("CheckCheck");
exports.Copy = createMockIcon("Copy");
exports.Wand2 = createMockIcon("Wand2");
exports.Tags = createMockIcon("Tags");
exports.FolderInput = createMockIcon("FolderInput");
exports.CheckCircle = createMockIcon("CheckCircle");
exports.Brain = createMockIcon("Brain");
exports.Compass = createMockIcon("Compass");
exports.BookmarkIcon = createMockIcon("BookmarkIcon");
exports.Bot = createMockIcon("Bot");
exports.Send = createMockIcon("Send");
exports.MessageCircle = createMockIcon("MessageCircle");
exports.Expand = createMockIcon("Expand");
exports.Lightbulb = createMockIcon("Lightbulb");
exports.ThumbsUp = createMockIcon("ThumbsUp");
exports.ThumbsDown = createMockIcon("ThumbsDown");
exports.BookOpen = createMockIcon("BookOpen");
exports.Target = createMockIcon("Target");
exports.Trash2 = createMockIcon("Trash2");

// Also export a default for individual icon file imports (via modularizeImports transform)
// When lucide-react/dist/esm/icons/compass is imported, it needs a default export
exports.default = createMockIcon("MockIcon");
