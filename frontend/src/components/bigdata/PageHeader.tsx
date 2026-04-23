import React, { type ReactNode } from 'react';
import { RefPageHead } from '../ref';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

/**
 * Thin wrapper over the shared reference page head so every big-data
 * screen matches the rest of the admin vocabulary (display serif title,
 * muted subtitle, trailing action slot). Kept here for backward-compat
 * with existing bigdata page imports.
 */
const PageHeader: React.FC<PageHeaderProps> = ({ title, description, actions }) => (
  <RefPageHead title={title} subtitle={description} actions={actions} />
);

export default PageHeader;
