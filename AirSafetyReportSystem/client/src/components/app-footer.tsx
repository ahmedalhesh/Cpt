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
          <span className="font-medium">Ahmed .H Alhesh</span>
          <a href="mailto:ahmed.alhesh@gmaul.com" className="hover:underline">ahmed.alhesh@gmaul.com</a>
          <a href="tel:+218913402222" className="hover:underline">+218913402222</a>
          <a href="tel:+4808646686" className="hover:underline">+4808646686</a>
        </div>
      </div>
    </footer>
  );
}

export default AppFooter;


