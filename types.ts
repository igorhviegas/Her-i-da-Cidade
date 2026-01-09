
export interface Service {
  id: string;
  title: string;
  price: string;
  description: string;
  imageUrl: string;
  category: string;
}

export interface Review {
  id: string;
  author: string;
  rating: number;
  comment: string;
  avatar: string;
}
