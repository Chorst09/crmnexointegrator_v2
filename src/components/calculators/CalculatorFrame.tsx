import { Card, CardContent } from '@/components/ui/card';
import React from 'react';

interface CalculatorFrameProps {
  src: string;
  title: string;
}

const CalculatorFrame: React.FC<CalculatorFrameProps> = ({ src, title }) => (
    <Card className="shadow-lg w-full h-full flex flex-col">
        <CardContent className="p-0 w-full h-full flex-grow">
            <iframe 
                src={src} 
                className="w-full h-full border-0 rounded-b-lg" 
                title={title}
            ></iframe>
        </CardContent>
    </Card>
);

export default CalculatorFrame;
