import { apiResponseToFormData } from "./src/features/properties/types/index.js";

const apiData = {
  "extra": {
    "picturesUrl": [
      "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&auto=format&fit=crop&q=60"
    ]
  }
};

const formData = apiResponseToFormData(apiData as any);
console.log("Parsed thumbnailUrl:", formData.thumbnailUrl);
