import { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

interface MermaidProps {
  chart: string;
}

let renderCounter = 0;

export default function Mermaid({ chart }: MermaidProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>('');

  useEffect(() => {
    const renderChart = async () => {
      const isDark = document.documentElement.dataset.theme === 'dark';

      mermaid.initialize({
        startOnLoad: false,
        theme: isDark ? 'dark' : 'default',
        securityLevel: 'loose',
      });

      const uniqueId = `mermaid-${Date.now()}-${++renderCounter}`;

      try {
        const { svg: renderedSvg } = await mermaid.render(uniqueId, chart);

        // Post-process SVG to make background transparent
        const processedSvg = renderedSvg.replace(
          /style="background-color:[^"]*"/g,
          'style="background-color:transparent"'
        );

        setSvg(processedSvg);
      } catch (error) {
        console.error('Mermaid rendering error:', error);
      }
    };

    renderChart();

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'data-theme') {
          renderChart();
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    return () => observer.disconnect();
  }, [chart]);

  return (
    <div
      ref={containerRef}
      className="mermaid-container"
      dangerouslySetInnerHTML={{ __html: svg }}
      style={{
        display: 'flex',
        justifyContent: 'center',
        margin: '1.5rem 0',
      }}
    />
  );
}
