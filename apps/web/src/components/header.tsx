"use client";
import Link from "next/link";
import Image from "next/image";
import { buttonVariants } from "./ui/button";
import { ModeToggle } from "./mode-toggle";

export default function Header() {
  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center">
            <span className="inline-flex items-center rounded-md bg-black px-3 py-2 shadow-sm">
              <Image
                src="/logo.png"
                alt="Polygraph"
                width={2048}
                height={674}
                priority
                className="h-8 w-auto"
              />
            </span>
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <nav className="hidden md:flex items-center gap-6 mr-4">
            <Link href="/" className="text-sm font-medium hover:text-primary transition-colors">Home</Link>
            <Link href={"/about" as any} className="text-sm font-medium hover:text-primary transition-colors">About</Link>
            <Link href={"/services" as any} className="text-sm font-medium hover:text-primary transition-colors">Services</Link>
          </nav>
          <ModeToggle />
          <Link 
            href="/login" 
            className={buttonVariants({ variant: "outline", className: "border-primary text-primary hover:bg-primary/5 rounded-full" })}
          >
            Sign In
          </Link>
        </div>
      </div>
    </header>
  );
}
