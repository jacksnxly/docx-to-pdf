FROM node:22-slim

ENV DEBIAN_FRONTEND=noninteractive

# Enable contrib repo (required for ttf-mscorefonts-installer)
RUN sed -i 's/^Components: main$/Components: main contrib/' /etc/apt/sources.list.d/debian.sources

# Pre-accept Microsoft EULA
RUN echo "ttf-mscorefonts-installer msttcorefonts/accepted-mscorefonts-eula select true" \
    | debconf-set-selections

RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice-writer \
    # Java runtime — required by LibreOffice for complex DOCX features
    # (advanced fields, embedded objects, certain import filters)
    default-jre-headless \
    libreoffice-java-common \
    # Microsoft Core Fonts (Arial, Times New Roman, Courier New, Georgia, Verdana)
    ttf-mscorefonts-installer \
    # Metrically compatible substitutes for Calibri and Cambria
    fonts-crosextra-carlito \
    fonts-crosextra-caladea \
    # Croscore fonts (Arimo=Arial, Tinos=TNR, Cousine=Courier New)
    fonts-croscore \
    # Liberation fonts (another set of MS font replacements)
    fonts-liberation \
    # DejaVu (good Unicode coverage fallback)
    fonts-dejavu-core \
    # Fontconfig for font discovery and substitution
    fontconfig \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Fontconfig substitution rules (Calibri->Carlito, Cambria->Caladea)
COPY fontconfig/ /etc/fonts/conf.d/

# Rebuild font cache
RUN fc-cache -fv

# LibreOffice user profile with PDF export settings
RUN mkdir -p /root/.config/libreoffice/4/user/
COPY libreoffice/registrymodifications.xcu /root/.config/libreoffice/4/user/registrymodifications.xcu

WORKDIR /app
COPY server.js .

EXPOSE 3001
CMD ["node", "server.js"]
