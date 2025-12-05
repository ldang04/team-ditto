import { Link } from 'react-router-dom';
import { AlertCircle, ArrowRight, Palette, FolderKanban } from 'lucide-react';

interface WorkflowBlockProps {
  title: string;
  message: string;
  missingItem: 'theme' | 'project' | 'project-with-theme';
  actionHref: string;
  actionText: string;
}

export default function WorkflowBlock({
  title,
  message,
  missingItem,
  actionHref,
  actionText,
}: WorkflowBlockProps) {
  const Icon = missingItem === 'theme' ? Palette : FolderKanban;

  return (
    <div className="card bg-yellow-50 border-yellow-200">
      <div className="flex items-start gap-4">
        <AlertCircle className="h-6 w-6 text-yellow-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-yellow-900 mb-2">{title}</h3>
          <p className="text-yellow-800 mb-4">{message}</p>
          <Link
            to={actionHref}
            className="btn btn-primary inline-flex items-center gap-2"
          >
            <Icon className="h-4 w-4" />
            {actionText}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

