import React from "react";

export function AppFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t bg-background">
      <div className="container max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row gap-2 sm:gap-4 sm:items-center justify-between text-xs sm:text-sm text-muted-foreground">
        <div>
          © {year} All rights reserved.
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
          <span className="font-medium">Developed and Designed by</span>
          <span className="font-medium">Ahmed .H Alhesh</span>
          <a href="mailto:ahmed.alhesh@gmail.com" className="hover:underline">ahmed.alhesh@gmail.com</a>
          <a href="tel:+14808646686" className="hover:underline">+1 (480) 864-6686</a>
          <a href="tel:+218913402222" className="hover:underline">+218 91 340 2222</a>
        </div>
      </div>
    </footer>
  );
}

export default AppFooter;


