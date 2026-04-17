import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(function Card(
  { hoverable, className, children, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={['smc-card', hoverable && 'smc-card--hoverable', className || ''].filter(Boolean).join(' ')}
      {...rest}
    >
      {children}
    </div>
  );
});

export const CardHeader: React.FC<
  React.HTMLAttributes<HTMLDivElement> & { title?: React.ReactNode; extra?: React.ReactNode }
> = ({ title, extra, children, className, ...rest }) => (
  <div className={['smc-card__header', className || ''].join(' ')} {...rest}>
    {title ? <div className="smc-card__title">{title}</div> : children}
    {extra && <div>{extra}</div>}
  </div>
);

export const CardBody: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  ...rest
}) => <div className={['smc-card__body', className || ''].join(' ')} {...rest} />;

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  ...rest
}) => <div className={['smc-card__footer', className || ''].join(' ')} {...rest} />;

export default Card;
