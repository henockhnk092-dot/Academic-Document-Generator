import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface HeroProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title: React.ReactNode;
  subtitle: string;
  images: { src: string; alt: string }[];
  buttons?: React.ReactNode;
}

export const HeroSection = React.forwardRef<HTMLDivElement, HeroProps>(
  ({ title, subtitle, images, buttons, className, ...props }, ref) => {
    const [currentIndex, setCurrentIndex] = React.useState(Math.floor(images.length / 2));

    const handleNext = React.useCallback(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }, [images.length]);

    const handlePrev = () => {
      setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
    };

    React.useEffect(() => {
      const timer = setInterval(handleNext, 4000);
      return () => clearInterval(timer);
    }, [handleNext]);

    return (
      <div
        ref={ref}
        className={cn(
          'relative w-full flex flex-col items-center justify-center overflow-x-hidden bg-background text-foreground',
          className
        )}
        {...props}
      >
        {/* Background gradients */}
        <div className="absolute inset-0 z-0 opacity-20 pointer-events-none" aria-hidden="true">
          <div className="absolute bottom-0 left-[-20%] top-[-10%] h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle_farthest-side,rgba(128,90,213,0.4),rgba(255,255,255,0))]" />
          <div className="absolute bottom-0 right-[-20%] top-[-10%] h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle_farthest-side,rgba(99,102,241,0.4),rgba(255,255,255,0))]" />
        </div>

        <div className="z-10 flex w-full flex-col items-center text-center space-y-8">
          {/* Title */}
          <h1 className="font-fredericka text-4xl sm:text-5xl md:text-6xl tracking-tight max-w-4xl">
            {title}
          </h1>

          {/* Carousel */}
          <div className="relative w-full h-[180px] sm:h-[200px] md:h-[280px] flex items-center justify-center">
            <div className="relative w-full h-full flex items-center justify-center [perspective:1200px]">
              {images.map((image, index) => {
                const total = images.length;
                let pos = ((index - currentIndex) + total) % total;
                if (pos > Math.floor(total / 2)) pos -= total;

                const isCenter   = pos === 0;
                const isAdjacent = Math.abs(pos) === 1;

                // On very small screens show only center image to avoid overflow
                const hideSide = typeof window !== "undefined" && window.innerWidth < 480 && !isCenter;

                return (
                  <div
                    key={index}
                    className="absolute transition-all duration-500 ease-in-out"
                    style={{
                      width:  'clamp(180px, 70vw, 480px)',
                      height: 'clamp(101px, 39vw, 270px)',
                      transform: `
                        translateX(${pos * (typeof window !== "undefined" && window.innerWidth < 480 ? 0 : 48)}%)
                        scale(${isCenter ? 1 : isAdjacent ? 0.82 : 0.65})
                        rotateY(${pos * -12}deg)
                      `,
                      zIndex:     isCenter ? 10 : isAdjacent ? 5 : 1,
                      opacity:    hideSide ? 0 : isCenter ? 1 : isAdjacent ? 0.45 : 0,
                      filter:     isCenter ? 'blur(0px)' : 'blur(3px)',
                      visibility: (Math.abs(pos) > 1 || hideSide) ? 'hidden' : 'visible',
                    }}
                  >
                    <img
                      src={image.src}
                      alt={image.alt}
                      className="object-cover w-full h-full rounded-2xl border-2 border-foreground/10 shadow-2xl"
                    />
                  </div>
                );
              })}
            </div>

            {/* Prev / Next */}
            <Button
              variant="outline"
              size="icon"
              className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 rounded-full h-10 w-10 z-20 bg-background/60 backdrop-blur-sm"
              onClick={handlePrev}
              aria-label="Previous"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 rounded-full h-10 w-10 z-20 bg-background/60 backdrop-blur-sm"
              onClick={handleNext}
              aria-label="Next"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>

            {/* Dot indicators */}
            <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 flex gap-1.5 z-20">
              {images.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentIndex(i)}
                  className={cn(
                    'rounded-full transition-all duration-300',
                    i === currentIndex
                      ? 'w-5 h-2 bg-primary'
                      : 'w-2 h-2 bg-foreground/20 hover:bg-foreground/40'
                  )}
                  aria-label={`Go to slide ${i + 1}`}
                />
              ))}
            </div>
          </div>

          {/* Subtitle + buttons after carousel */}
          <div className="space-y-6 pt-10">
            <p className="max-w-2xl mx-auto text-muted-foreground md:text-xl">
              {subtitle}
            </p>
            {buttons && (
              <div className="flex flex-wrap justify-center gap-4">
                {buttons}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
);

HeroSection.displayName = 'HeroSection';
