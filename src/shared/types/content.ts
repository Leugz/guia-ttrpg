export interface Handout {
  id: string;
  title: string;
  category: string;
  content_type: string;
  is_public: boolean;
  shared_with: string[];
  content: string;
}
