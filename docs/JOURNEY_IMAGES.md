# Journey image collection

Generated with the built-in image generation tool on 2026-09-06. Eight original scenes were inspected and converted to WebP delivery variants without cropping. Files are in `public/journey/{name}-v1-{800,1536}.webp`. Existing four orbit scenes remain; twelve scenes total.

These are decorative editorial illustrations, never actual vehicle, battery construction, facility, or maintenance evidence. Main-screen boilerplate is removed; the service guide retains this distinction. All actual values and controls remain live DOM.

## Final prompts

## Delivery and checks

- Eight images, two responsive sizes each: 16 WebP files, 1,295,380 bytes combined.
- Home background tour: 12 scenes, five-second intervals, manual previous/next,
  pause/play. Hidden pages, reduced motion, and open connection dialogs suspend autoplay.
- New backgrounds retain the last loaded scene while the requested image loads.
- Six image navigation cards, four image-backed vehicle metrics, garage cover,
  schedule/cost covers, page headers, battery, tire, parking and connection artwork.
- The live map and actual service-center results are not replaced by generated imagery.
- Browser checks: 320px / 390px / 1440px; no horizontal overflow or broken images;
  manual scene change pauses the tour and remains paused during subsequent checks.
- Connection modal cover and action checked at 320px. Parking shortcut selects
  the parking tab; charging and service-center queries still display real results.
- Six Node tests passed (asset validity/budget plus existing read-retry behavior).
- Production build passed. No backend, credentials or permissions were changed.

## Prompt set

### charge

Use case: stylized-concept. Asset type: premium cinematic automotive website background and feature card, landscape 1536x1024. Photorealistic high-end CGI, tactile brushed silver, Hyundai-inspired midnight navy, icy cyan accents, spectacular but refined space-and-mobility world, realistic car proportions. No text, no letters, no numbers, no logos, no watermark, no interface graphics. Main subject clearly visible in central 60 percent for mobile cropping, leave uncluttered dark lower edge for real UI overlay. A silver Hyundai Ioniq 5-inspired electric crossover connected by one plausible cable to a sleek charging pedestal on a futuristic seaside terrace at blue hour. A giant luminous orbital ring arcs through the sky. Low three-quarter camera, car and charging connector obvious, strong clean architectural lighting, navy and cyan reflections.

Saved: public/journey/charge-v1-800.webp and public/journey/charge-v1-1536.webp.

### battery

Use case: stylized-concept. Asset type: premium cinematic automotive website background and feature card, landscape 1536x1024. Photorealistic high-end CGI, tactile brushed silver, Hyundai-inspired midnight navy, icy cyan accents, spectacular but refined space-and-mobility world, realistic car proportions. No text, no letters, no numbers, no logos, no watermark, no interface graphics. Main subject clearly visible in central 60 percent for mobile cropping, leave uncluttered dark lower edge for real UI overlay. A spectacular close perspective of an electric crossover's skateboard battery pack in a pristine aerospace laboratory, pearl silver body hovering slightly above the structurally plausible flat battery assembly as an exploded product render. Cyan edge illumination and navy glass, softly visible Earth through a curved panoramic window. No diagrams or numerical data.

Saved: public/journey/battery-v1-800.webp and public/journey/battery-v1-1536.webp.

### tires

Use case: stylized-concept. Asset type: premium cinematic automotive website background and feature card, landscape 1536x1024. Photorealistic high-end CGI, tactile brushed silver, Hyundai-inspired midnight navy, icy cyan accents, spectacular but refined space-and-mobility world, realistic car proportions. No text, no letters, no numbers, no logos, no watermark, no interface graphics. Main subject clearly visible in central 60 percent for mobile cropping, leave uncluttered dark lower edge for real UI overlay. Extreme premium automotive close-up of a silver electric crossover front wheel, beautifully machined geometric alloy rim, perfectly plausible black tire and sharp realistic tread. Cyan light traces reflected from an orbital inspection bay, deep navy surrounding, small distant stars. Wheel fills central image, confident engineered precision, not a schematic.

Saved: public/journey/tires-v1-800.webp and public/journey/tires-v1-1536.webp.

### road

Use case: stylized-concept. Asset type: premium cinematic automotive website background and feature card, landscape 1536x1024. Photorealistic high-end CGI, tactile brushed silver, Hyundai-inspired midnight navy, icy cyan accents, spectacular but refined space-and-mobility world, realistic car proportions. No text, no letters, no numbers, no logos, no watermark, no interface graphics. Main subject clearly visible in central 60 percent for mobile cropping, leave uncluttered dark lower edge for real UI overlay. A silver Hyundai Ioniq 5-inspired electric crossover driving on a sweeping empty elevated coastal road curving toward a spectacular luminous horizon with a pale moon and subtle aurora. Dynamic rear three-quarter low camera, controlled motion blur only in road and edges, car razor sharp. Silver paint, navy ocean, cyan dawn, premium automotive campaign.

Saved: public/journey/road-v1-800.webp and public/journey/road-v1-1536.webp.

### parking

Use case: stylized-concept. Asset type: premium cinematic automotive website background and feature card, landscape 1536x1024. Photorealistic high-end CGI, tactile brushed silver, Hyundai-inspired midnight navy, icy cyan accents, spectacular but refined space-and-mobility world, realistic car proportions. No text, no letters, no numbers, no logos, no watermark, no interface graphics. Main subject clearly visible in central 60 percent for mobile cropping, leave uncluttered dark lower edge for real UI overlay. A silver Hyundai Ioniq 5-inspired electric crossover parked on a single circular illuminated parking platform in an immense elegant orbital parking pavilion. Clear cyan floor guide lines lead to the car, a huge curved window reveals a quiet starry sky. Front three-quarter elevated view, strong architectural symmetry, clean and welcoming, actual rubber tires resting on the ground.

Saved: public/journey/parking-v1-800.webp and public/journey/parking-v1-1536.webp.

### care

Use case: stylized-concept. Asset type: premium cinematic automotive website background and feature card, landscape 1536x1024. Photorealistic high-end CGI, tactile brushed silver, Hyundai-inspired midnight navy, icy cyan accents, spectacular but refined space-and-mobility world, realistic car proportions. No text, no letters, no numbers, no logos, no watermark, no interface graphics. Main subject clearly visible in central 60 percent for mobile cropping, leave uncluttered dark lower edge for real UI overlay. Silver Hyundai Ioniq 5-inspired electric crossover in a stunning circular precision service atelier, overhead white luminous inspection ring, floor rails and restrained service equipment, distant planet outside panoramic windows. Front three-quarter shot, car fully visible in middle, pearlescent surfaces with icy cyan highlights, architectural luxury automotive campaign.

Saved: public/journey/care-v1-800.webp and public/journey/care-v1-1536.webp.

### journal

Use case: stylized-concept. Asset type: premium cinematic automotive website background and feature card, landscape 1536x1024. Photorealistic high-end CGI, tactile brushed silver, Hyundai-inspired midnight navy, icy cyan accents, spectacular but refined space-and-mobility world, realistic car proportions. No text, no letters, no numbers, no logos, no watermark, no interface graphics. Main subject clearly visible in central 60 percent for mobile cropping, leave uncluttered dark lower edge for real UI overlay. A silver electric crossover seen through a long beautiful glass gallery whose successive freestanding illuminated arch frames recede into the distance, suggesting the remembered journeys and history of one car. Restrained glowing cyan lines follow the gallery floor, a spectacular starry horizon outside, navy and cool silver. Car large and visible centrally. No documents with text, no graphs, no screens, no numbers.

Saved: public/journey/journal-v1-800.webp and public/journey/journal-v1-1536.webp.

### connect

Use case: stylized-concept. Asset type: premium cinematic automotive website background and feature card, landscape 1536x1024. Photorealistic high-end CGI, tactile brushed silver, Hyundai-inspired midnight navy, icy cyan accents, spectacular but refined space-and-mobility world, realistic car proportions. No text, no letters, no numbers, no logos, no watermark, no interface graphics. Main subject clearly visible in central 60 percent for mobile cropping, leave uncluttered dark lower edge for real UI overlay. Close-up of a beautiful silver modern car key fob hovering above a softly lit open console inside a premium electric crossover cockpit. Through the windshield an orbital sunrise and elegant circular gateway architecture. Refined tactile leather and machined metal, cyan rim illumination, dark navy lighting. The key is a simple realistic physical fob with blank surfaces, no logos or typography, cinematic shallow depth of field.

Saved: public/journey/connect-v1-800.webp and public/journey/connect-v1-1536.webp.
