import * as React from "react"
import { Search, Sparkles, Settings, Layers, Server, Key, FileText, BookOpen, Github, ExternalLink } from "lucide-react"
import { useSetupStore } from "../store/setupStore"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { Separator } from "./ui/separator"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
} from "./ui/sidebar"

// Navigation data for the wizard
const navData = {
  main: [
    {
      title: "Setup Steps",
      items: [
        {
          title: "Welcome",
          icon: Sparkles,
          step: 0,
        },
        {
          title: "Basic Config",
          icon: Settings,
          step: 1,
        },
        {
          title: "Stack Selection",
          icon: Layers,
          step: 2,
        },
        {
          title: "Service Config",
          icon: Server,
          step: 3,
        },
        {
          title: "Advanced",
          icon: Key,
          step: 4,
        },
        {
          title: "Review & Generate",
          icon: FileText,
          step: 5,
        },
      ],
    },
  ],
  secondary: [
    {
      title: "Resources",
      items: [
        {
          title: "Documentation",
          icon: BookOpen,
          url: "/docs",
        },
        {
          title: "GitHub",
          icon: Github,
          url: "https://github.com/your-repo",
        },
      ],
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { currentStep } = useSetupStore()

  return (
    <Sidebar {...props}>
      <SidebarHeader className="bg-gradient-to-b from-emerald-500/10 via-cyan-500/10 to-transparent">
        <div className="flex items-center gap-2 px-2 py-1">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-r from-emerald-500 via-cyan-500 to-lime-400 text-white shadow-lg">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">Media Stack</span>
            <span className="text-xs text-muted-foreground">Setup Wizard</span>
          </div>
        </div>
        <SearchForm />
      </SidebarHeader>
      <SidebarContent>
        {/* Main Navigation - Setup Steps */}
        {navData.main.map((group) => (
          <SidebarGroup key={group.title}>
            <SidebarGroupLabel className="text-xs font-medium text-muted-foreground">
              {group.title}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const Icon = item.icon
                  const isActive = 'step' in item && item.step === currentStep
                  const isCompleted = 'step' in item && item.step < currentStep

                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton 
                        isActive={isActive}
                        className={isCompleted ? "text-green-600" : ""}
                      >
                        <button
                          onClick={() => {
                            // Navigate to step if it's a step
                            if ('step' in item) {
                              const { setCurrentStep } = useSetupStore.getState()
                              setCurrentStep(item.step)
                            }
                          }}
                          className="w-full text-left"
                        >
                          <Icon className="w-4 h-4" />
                          <span>{item.title}</span>
                          {isCompleted && (
                            <div className="w-2 h-2 bg-green-500 rounded-full ml-auto" />
                          )}
                        </button>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}

        <Separator />

        {/* Secondary Navigation - Resources */}
        {navData.secondary.map((group) => (
          <SidebarGroup key={group.title}>
            <SidebarGroupLabel className="text-xs font-medium text-muted-foreground">
              {group.title}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const Icon = item.icon
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <a href={item.url} target="_blank" rel="noopener noreferrer">
                          <Icon className="w-4 h-4" />
                          <span>{item.title}</span>
                          <ExternalLink className="w-3 h-3 ml-auto" />
                        </a>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}

function SearchForm({ ...props }: React.ComponentProps<"form">) {
  return (
    <form {...props}>
      <SidebarGroup className="py-0">
        <SidebarGroupContent className="relative">
          <Label htmlFor="search" className="sr-only">
            Search
          </Label>
          <Input
            id="search"
            placeholder="Search setup steps..."
            className="pl-8 bg-background/50 border-border/50"
          />
          <Search className="pointer-events-none absolute top-1/2 left-2 w-4 h-4 -translate-y-1/2 opacity-50 select-none" />
        </SidebarGroupContent>
      </SidebarGroup>
    </form>
  )
}

// Main layout component that wraps the app
export function SidebarLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border/50 bg-background/50 backdrop-blur-sm">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <div className="flex items-center gap-2 px-4">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-r from-emerald-500 via-cyan-500 to-lime-400 text-white shadow-lg">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Media Stack Setup</h1>
              <p className="text-xs text-muted-foreground">Interactive Configuration Wizard</p>
            </div>
          </div>
        </header>
        <main className="flex-1">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
