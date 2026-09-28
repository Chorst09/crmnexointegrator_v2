import React from 'react';

const GradientCard = ({ 
  children, 
  gradient = 'blue',
  className = '',
  hover = true,
  onClick = null 
}) => {
  const gradients = {
    blue: 'bg-gradient-to-br from-blue-50 via-white to-blue-50 border-blue-200 hover:from-blue-100 hover:to-blue-50',
    green: 'bg-gradient-to-br from-green-50 via-white to-green-50 border-green-200 hover:from-green-100 hover:to-green-50',
    purple: 'bg-gradient-to-br from-purple-50 via-white to-purple-50 border-purple-200 hover:from-purple-100 hover:to-purple-50',
    orange: 'bg-gradient-to-br from-orange-50 via-white to-orange-50 border-orange-200 hover:from-orange-100 hover:to-orange-50',
    red: 'bg-gradient-to-br from-red-50 via-white to-red-50 border-red-200 hover:from-red-100 hover:to-red-50',
    yellow: 'bg-gradient-to-br from-yellow-50 via-white to-yellow-50 border-yellow-200 hover:from-yellow-100 hover:to-yellow-50',
    indigo: 'bg-gradient-to-br from-indigo-50 via-white to-indigo-50 border-indigo-200 hover:from-indigo-100 hover:to-indigo-50',
    pink: 'bg-gradient-to-br from-pink-50 via-white to-pink-50 border-pink-200 hover:from-pink-100 hover:to-pink-50',
    gray: 'bg-gradient-to-br from-gray-50 via-white to-gray-50 border-gray-200 hover:from-gray-100 hover:to-gray-50'
  };

  return (
    <div 
      className={`
        ${gradients[gradient]} 
        border rounded-2xl shadow-sm backdrop-blur-sm
        ${hover ? 'transition-all duration-300 hover:shadow-lg hover:scale-[1.02]' : ''}
        ${onClick ? 'cursor-pointer' : ''}
        ${className}
      `}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

export default GradientCard;