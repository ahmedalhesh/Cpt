declare module 'arabic-reshaper' {
  const arabicReshaper: {
    reshape: (text: string) => string;
  };
  export default arabicReshaper;
}

declare module 'bidi' {
  export function bidi(input: string): string;
}

declare module '@/lib/fonts/Amiri-Regular-normal.js' {
  const content: any;
  export default content;
}


