import { useState, useCallback } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from '../services/api';
import { Loader2, Check, ArrowLeft, Download } from 'lucide-react';

interface TextVariant {
  id: string;
  content: string;
  contentId?: string;
  score: number;
}

interface ImageVariant {
  id: string;
  imageUrl: string;
  score: number;
}

type Step = 'start' | 'picking-copy' | 'picking-image' | 'done';

export default function AssetGenerator() {
  const [step, setStep] = useState<Step>('start');
  const [prompt, setPrompt] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [copyOptions, setCopyOptions] = useState<TextVariant[]>([]);
  const [selectedCopy, setSelectedCopy] = useState<TextVariant | null>(null);
  const [imageOptions, setImageOptions] = useState<ImageVariant[]>([]);
  const [selectedImage, setSelectedImage] = useState<ImageVariant | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiClient.getProjects(),
  });

  const { data: themesData } = useQuery({
    queryKey: ['themes'],
    queryFn: () => apiClient.getThemes(),
  });

  const projects = projectsData?.data?.filter(p => p.theme_id) || [];
  const themes = themesData?.data || [];
  const selectedProject = projects.find(p => p.id === selectedProjectId);
  const selectedTheme = themes.find(t => t.id === selectedProject?.theme_id);

  // Step 1: Generate copy options
  const generateCopy = useMutation({
    mutationFn: async () => {
      setIsGenerating(true);
      const variants: TextVariant[] = [];

      // Generate 3 copy variants with small delay to avoid rate limiting
      for (let i = 0; i < 3; i++) {
        try {
          if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }

          const response = await apiClient.generateText({
            project_id: selectedProjectId,
            prompt: `${prompt}. Keep it short and punchy, under 12 words.`,
            variantCount: 1,
          });

          const variant = response.data?.variants?.[0];
          if (variant) {
            const validation = await apiClient.validateContent({
              content_id: variant.content_id,
              content: variant.generated_content,
              project_id: selectedProjectId,
              media_type: 'text',
            });

            variants.push({
              id: `copy-${i}`,
              content: variant.generated_content,
              contentId: variant.content_id,
              score: Math.round((validation.data?.validation?.brand_consistency_score || 0.7) * 100),
            });
          }
        } catch (e) {
          console.error('Failed to generate copy:', e);
        }
      }

      // Sort by score
      variants.sort((a, b) => b.score - a.score);
      setCopyOptions(variants);
      setStep('picking-copy');
      setIsGenerating(false);
    },
  });

  // Step 2: Generate images with selected copy
  const generateImages = useMutation({
    mutationFn: async () => {
      if (!selectedCopy) return;
      setIsGenerating(true);
      const variants: ImageVariant[] = [];

      // Generate 3 image variants with delay to avoid rate limiting
      for (let i = 0; i < 3; i++) {
        try {
          // Add delay between requests to avoid rate limiting (skip first)
          if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, 3000));
          }

          const response = await apiClient.generateImage({
            project_id: selectedProjectId,
            prompt: `Marketing visual for: ${prompt}`,
            overlay_text: selectedCopy.content,
            variantCount: 1,
          });

          const variant = response.data?.variants?.[0];
          if (variant) {
            const metrics = response.data?.computation_metrics;
            variants.push({
              id: `img-${i}`,
              imageUrl: variant.image_url,
              score: Math.round((metrics?.rag_similarity || 0.7) * 100),
            });
          }
        } catch (e) {
          console.error('Failed to generate image:', e);
          // If rate limited, wait longer before next attempt
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }

      variants.sort((a, b) => b.score - a.score);
      setImageOptions(variants);
      setStep('picking-image');
      setIsGenerating(false);
    },
  });

  const handleExport = useCallback(() => {
    if (!selectedCopy || !selectedImage) return;

    const data = {
      copy: selectedCopy.content,
      imageUrl: selectedImage.imageUrl,
      project: selectedProject?.name,
      createdAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'campaign-assets.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [selectedCopy, selectedImage, selectedProject]);

  const reset = () => {
    setStep('start');
    setPrompt('');
    setCopyOptions([]);
    setSelectedCopy(null);
    setImageOptions([]);
    setSelectedImage(null);
  };

  const canStart = prompt.trim() && selectedProjectId;

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Create Campaign</h1>
        <p className="text-gray-500 mt-1">
          Generate copy, pick your favorite, then create images with your text.
        </p>
      </div>

      {/* Step 1: Start */}
      {step === 'start' && (
        <div className="space-y-6">
          <div>
            <label className="block text-sm text-gray-600 mb-2">
              What are you promoting?
            </label>
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Summer sale, new product launch, holiday special..."
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-lg"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-2">
              Which campaign?
            </label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">Select a campaign...</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            {selectedTheme && (
              <p className="text-sm text-gray-500 mt-2">
                Using theme: {selectedTheme.name}
              </p>
            )}
          </div>

          <button
            onClick={() => generateCopy.mutate()}
            disabled={!canStart || isGenerating}
            className="w-full py-3 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isGenerating ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating copy options...
              </span>
            ) : (
              'Generate Copy'
            )}
          </button>
        </div>
      )}

      {/* Step 2: Pick Copy */}
      {step === 'picking-copy' && (
        <div>
          <button
            onClick={reset}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            Start over
          </button>

          <p className="text-gray-600 mb-4">Pick the copy you like best:</p>

          <div className="space-y-3 mb-6">
            {copyOptions.map((option, i) => (
              <button
                key={option.id}
                onClick={() => setSelectedCopy(option)}
                className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                  selectedCopy?.id === option.id
                    ? 'border-gray-900 bg-gray-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-start justify-between">
                  <p className="text-gray-900 text-lg pr-4">"{option.content}"</p>
                  {selectedCopy?.id === option.id && (
                    <Check className="h-5 w-5 text-gray-900 flex-shrink-0" />
                  )}
                </div>
                {i === 0 && (
                  <span className="inline-block mt-2 text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                    Best match
                  </span>
                )}
              </button>
            ))}
          </div>

          <button
            onClick={() => generateImages.mutate()}
            disabled={!selectedCopy || isGenerating}
            className="w-full py-3 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isGenerating ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating images...
              </span>
            ) : (
              'Create Images with This Copy'
            )}
          </button>
        </div>
      )}

      {/* Step 3: Pick Image */}
      {step === 'picking-image' && (
        <div>
          <button
            onClick={() => setStep('picking-copy')}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to copy
          </button>

          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">Your copy: "{selectedCopy?.content}"</p>
          </div>

          <p className="text-gray-600 mb-4">Pick your image:</p>

          <div className="grid grid-cols-3 gap-4 mb-6">
            {imageOptions.map((option, i) => (
              <button
                key={option.id}
                onClick={() => setSelectedImage(option)}
                className={`relative rounded-lg overflow-hidden border-2 transition-all aspect-square ${
                  selectedImage?.id === option.id
                    ? 'border-gray-900'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <img
                  src={option.imageUrl}
                  alt={`Option ${i + 1}`}
                  className="w-full h-full object-cover"
                />
                {selectedImage?.id === option.id && (
                  <div className="absolute top-2 right-2 bg-gray-900 rounded-full p-1">
                    <Check className="h-4 w-4 text-white" />
                  </div>
                )}
                {i === 0 && (
                  <span className="absolute bottom-2 left-2 text-xs text-white bg-black/50 px-2 py-0.5 rounded">
                    Best match
                  </span>
                )}
              </button>
            ))}
          </div>

          <button
            onClick={() => setStep('done')}
            disabled={!selectedImage}
            className="w-full py-3 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Finish
          </button>
        </div>
      )}

      {/* Step 4: Done */}
      {step === 'done' && selectedCopy && selectedImage && (
        <div>
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mb-4">
              <Check className="h-6 w-6 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Done!</h2>
            <p className="text-gray-500">Your campaign assets are ready.</p>
          </div>

          <div className="rounded-lg overflow-hidden border border-gray-200 mb-6">
            <img
              src={selectedImage.imageUrl}
              alt="Final campaign image"
              className="w-full"
            />
          </div>

          <div className="p-4 bg-gray-50 rounded-lg mb-6">
            <p className="text-lg text-gray-900 text-center">"{selectedCopy.content}"</p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleExport}
              className="flex-1 py-3 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 flex items-center justify-center gap-2"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
            <button
              onClick={reset}
              className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200"
            >
              Create Another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
