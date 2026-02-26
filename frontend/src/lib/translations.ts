export type Language = 'en' | 'es' | 'fr' | 'de' | 'pt' | 'zh' | 'ja' | 'ko' | 'ar' | 'hi'

export interface Translation {
  app: {
    title: string
    subtitle: string
    version: string
    systemReady: string
    needHelp: string
  }
  nav: {
    liveAssist: string
    aiAssistant: string
    setup: string
    ocr: string
    reports: string
    history: string
  }
  live: {
    startCamera: string
    stopCamera: string
    pushToTalk: string
    recording: string
    snapshot: string
    stop: string
    switchCamera: string
    selfie: string
    back: string
  }
  status: {
    connected: string
    disconnected: string
    streaming: string
    loading: string
    error: string
  }
  safety: {
    missingPPE: string
    dangerousProximity: string
    leak: string
    spark: string
    exposedWire: string
    slipperySurface: string
    openFlame: string
  }
  actions: {
    runOCR: string
    syncOffline: string
    startInspection: string
    endInspection: string
  }
  setup: {
    createTechnician: string
    createSite: string
    selectTechnician: string
    selectSite: string
    technicianName: string
    technicianEmail: string
    siteName: string
    siteType: string
    start: string
  }
  ocr: {
    title: string
    uploadImage: string
    extractText: string
    results: string
    serialNumbers: string
    partCodes: string
    meterReadings: string
    warningLabels: string
  }
  reports: {
    title: string
    download: string
    view: string
    noReports: string
  }
  history: {
    title: string
    noHistory: string
    filterByDate: string
    filterBySite: string
  }
}

const translations: Record<Language, Translation> = {
  en: {
    app: {
      title: 'FieldSight',
      subtitle: 'AI Field Assistant',
      version: 'v1.0.0',
      systemReady: 'System ready',
      needHelp: 'Need help?',
    },
    nav: {
      liveAssist: 'Live Assist',
      aiAssistant: 'AI Assistant',
      setup: 'Setup',
      ocr: 'OCR',
      reports: 'Reports',
      history: 'History',
    },
    live: {
      startCamera: 'Start Camera',
      stopCamera: 'Stop Camera',
      pushToTalk: 'Push to Talk',
      recording: 'Recording...',
      snapshot: 'Snapshot',
      stop: 'Stop',
      switchCamera: 'Switch Camera',
      selfie: 'Selfie',
      back: 'Back',
    },
    status: {
      connected: 'Connected',
      disconnected: 'Disconnected',
      streaming: 'Streaming',
      loading: 'Loading...',
      error: 'Error',
    },
    safety: {
      missingPPE: 'Missing PPE',
      dangerousProximity: 'Dangerous Proximity',
      leak: 'Leak Detected',
      spark: 'Spark Detected',
      exposedWire: 'Exposed Wire',
      slipperySurface: 'Slippery Surface',
      openFlame: 'Open Flame',
    },
    actions: {
      runOCR: 'Run OCR',
      syncOffline: 'Sync Offline',
      startInspection: 'Start Inspection',
      endInspection: 'End Inspection',
    },
    setup: {
      createTechnician: 'Create Technician',
      createSite: 'Create Site',
      selectTechnician: 'Select Technician',
      selectSite: 'Select Site',
      technicianName: 'Name',
      technicianEmail: 'Email',
      siteName: 'Site Name',
      siteType: 'Site Type',
      start: 'Start',
    },
    ocr: {
      title: 'Equipment OCR',
      uploadImage: 'Upload Image',
      extractText: 'Extract Text',
      results: 'Results',
      serialNumbers: 'Serial Numbers',
      partCodes: 'Part Codes',
      meterReadings: 'Meter Readings',
      warningLabels: 'Warning Labels',
    },
    reports: {
      title: 'Inspection Reports',
      download: 'Download',
      view: 'View',
      noReports: 'No reports available',
    },
    history: {
      title: 'Inspection History',
      noHistory: 'No inspection history',
      filterByDate: 'Filter by Date',
      filterBySite: 'Filter by Site',
    },
  },
  es: {
    app: {
      title: 'FieldSight',
      subtitle: 'Asistente de Campo IA',
      version: 'v1.0.0',
      systemReady: 'Sistema listo',
      needHelp: '¿Necesita ayuda?',
    },
    nav: {
      liveAssist: 'Asistencia en Vivo',
      aiAssistant: 'Asistente IA',
      setup: 'Configuración',
      ocr: 'OCR',
      reports: 'Informes',
      history: 'Historial',
    },
    live: {
      startCamera: 'Iniciar Cámara',
      stopCamera: 'Detener Cámara',
      pushToTalk: 'Pulsar para Hablar',
      recording: 'Grabando...',
      snapshot: 'Captura',
      stop: 'Detener',
      switchCamera: 'Cambiar Cámara',
      selfie: 'Selfie',
      back: 'Trasera',
    },
    status: {
      connected: 'Conectado',
      disconnected: 'Desconectado',
      streaming: 'Transmitiendo',
      loading: 'Cargando...',
      error: 'Error',
    },
    safety: {
      missingPPE: 'EPP Faltante',
      dangerousProximity: 'Proximidad Peligrosa',
      leak: 'Fuga Detectada',
      spark: 'Chispa Detectada',
      exposedWire: 'Cable Expuesto',
      slipperySurface: 'Superficie Resbaladiza',
      openFlame: 'Llama Abierta',
    },
    actions: {
      runOCR: 'Ejecutar OCR',
      syncOffline: 'Sincronizar Offline',
      startInspection: 'Iniciar Inspección',
      endInspection: 'Finalizar Inspección',
    },
    setup: {
      createTechnician: 'Crear Técnico',
      createSite: 'Crear Sitio',
      selectTechnician: 'Seleccionar Técnico',
      selectSite: 'Seleccionar Sitio',
      technicianName: 'Nombre',
      technicianEmail: 'Correo',
      siteName: 'Nombre del Sitio',
      siteType: 'Tipo de Sitio',
      start: 'Iniciar',
    },
    ocr: {
      title: 'OCR de Equipos',
      uploadImage: 'Subir Imagen',
      extractText: 'Extraer Texto',
      results: 'Resultados',
      serialNumbers: 'Números de Serie',
      partCodes: 'Códigos de Pieza',
      meterReadings: 'Lecturas del Medidor',
      warningLabels: 'Etiquetas de Advertencia',
    },
    reports: {
      title: 'Informes de Inspección',
      download: 'Descargar',
      view: 'Ver',
      noReports: 'No hay informes disponibles',
    },
    history: {
      title: 'Historial de Inspección',
      noHistory: 'Sin historial de inspección',
      filterByDate: 'Filtrar por Fecha',
      filterBySite: 'Filtrar por Sitio',
    },
  },
  fr: {
    app: {
      title: 'FieldSight',
      subtitle: 'Assistant Terrain IA',
      version: 'v1.0.0',
      systemReady: 'Système prêt',
      needHelp: 'Besoin daide?',
    },
    nav: {
      liveAssist: 'Assistance en Direct',
      aiAssistant: 'Assistant IA',
      setup: 'Configuration',
      ocr: 'OCR',
      reports: 'Rapports',
      history: 'Historique',
    },
    live: {
      startCamera: 'Démarrer Caméra',
      stopCamera: 'Arrêter Caméra',
      pushToTalk: 'Appuyer pour Parler',
      recording: 'Enregistrement...',
      snapshot: 'Capture',
      stop: 'Arrêter',
      switchCamera: 'Changer Caméra',
      selfie: 'Selfie',
      back: 'Arrière',
    },
    status: {
      connected: 'Connecté',
      disconnected: 'Déconnecté',
      streaming: 'Diffusion',
      loading: 'Chargement...',
      error: 'Erreur',
    },
    safety: {
      missingPPE: 'EPI Manquant',
      dangerousProximity: 'Proximité Dangereuse',
      leak: 'Fuite Détectée',
      spark: 'Étincelle Détectée',
      exposedWire: 'Fil Exposée',
      slipperySurface: 'Surface Glissante',
      openFlame: 'Flamme Ouverte',
    },
    actions: {
      runOCR: 'Exécuter OCR',
      syncOffline: 'Synchroniser Hors Ligne',
      startInspection: 'Démarrer Inspection',
      endInspection: 'Terminer Inspection',
    },
    setup: {
      createTechnician: 'Créer Technicien',
      createSite: 'Créer Site',
      selectTechnician: 'Sélectionner Technicien',
      selectSite: 'Sélectionner Site',
      technicianName: 'Nom',
      technicianEmail: 'Email',
      siteName: 'Nom du Site',
      siteType: 'Type de Site',
      start: 'Démarrer',
    },
    ocr: {
      title: 'OCR Équipement',
      uploadImage: 'Télécharger Image',
      extractText: 'Extraire Texte',
      results: 'Résultats',
      serialNumbers: 'Numéros de Série',
      partCodes: 'Codes Pièce',
      meterReadings: 'Lectures Compteur',
      warningLabels: 'Étiquettes Avertissement',
    },
    reports: {
      title: 'Rapports dInspection',
      download: 'Télécharger',
      view: 'Voir',
      noReports: 'Aucun rapport disponible',
    },
    history: {
      title: 'Historique des Inspections',
      noHistory: 'Aucun historique',
      filterByDate: 'Filtrer par Date',
      filterBySite: 'Filtrer par Site',
    },
  },
  de: {
    app: {
      title: 'FieldSight',
      subtitle: 'KI-Feldassistent',
      version: 'v1.0.0',
      systemReady: 'System bereit',
      needHelp: 'Brauchen Sie Hilfe?',
    },
    nav: {
      liveAssist: 'Live-Assistenz',
      aiAssistant: 'KI-Assistent',
      setup: 'Einrichtung',
      ocr: 'OCR',
      reports: 'Berichte',
      history: 'Verlauf',
    },
    live: {
      startCamera: 'Kamera Starten',
      stopCamera: 'Kamera Stoppen',
      pushToTalk: 'Drücken zum Sprechen',
      recording: 'Aufnahme...',
      snapshot: 'Snapshot',
      stop: 'Stopp',
      switchCamera: 'Kamera Wechseln',
      selfie: 'Selfie',
      back: 'Rückseite',
    },
    status: {
      connected: 'Verbunden',
      disconnected: 'Getrennt',
      streaming: 'Streaming',
      loading: 'Laden...',
      error: 'Fehler',
    },
    safety: {
      missingPPE: 'Fehlende PSA',
      dangerousProximity: 'Gefährliche Nähe',
      leak: 'Leck Erkannt',
      spark: 'Funke Erkannt',
      exposedWire: 'Freiliegender Draht',
      slipperySurface: 'Rutschige Oberfläche',
      openFlame: 'Offene Flamme',
    },
    actions: {
      runOCR: 'OCR Ausführen',
      syncOffline: 'Offline Synchronisieren',
      startInspection: 'Inspektion Starten',
      endInspection: 'Inspektion Beenden',
    },
    setup: {
      createTechnician: 'Techniker Erstellen',
      createSite: 'Standort Erstellen',
      selectTechnician: 'Techniker Auswählen',
      selectSite: 'Standort Auswählen',
      technicianName: 'Name',
      technicianEmail: 'E-Mail',
      siteName: 'Standortname',
      siteType: 'Standorttyp',
      start: 'Starten',
    },
    ocr: {
      title: 'Geräte-OCR',
      uploadImage: 'Bild Hochladen',
      extractText: 'Text Extrahieren',
      results: 'Ergebnisse',
      serialNumbers: 'Seriennummern',
      partCodes: 'Teilecodes',
      meterReadings: 'Zählerstände',
      warningLabels: 'Warnschilder',
    },
    reports: {
      title: 'Inspektionsberichte',
      download: 'Herunterladen',
      view: 'Ansehen',
      noReports: 'Keine Berichte verfügbar',
    },
    history: {
      title: 'Inspektionsverlauf',
      noHistory: 'Kein Verlauf',
      filterByDate: 'Nach Datum Filtern',
      filterBySite: 'Nach Standort Filtern',
    },
  },
  pt: {
    app: {
      title: 'FieldSight',
      subtitle: 'Assistente de Campo IA',
      version: 'v1.0.0',
      systemReady: 'Sistema pronto',
      needHelp: 'Precisa de ajuda?',
    },
    nav: {
      liveAssist: 'Assistência ao Vivo',
      aiAssistant: 'Assistente IA',
      setup: 'Configuração',
      ocr: 'OCR',
      reports: 'Relatórios',
      history: 'Histórico',
    },
    live: {
      startCamera: 'Iniciar Câmera',
      stopCamera: 'Parar Câmera',
      pushToTalk: 'Pressione para Falar',
      recording: 'Gravando...',
      snapshot: 'Captura',
      stop: 'Parar',
      switchCamera: 'Trocar Câmera',
      selfie: 'Selfie',
      back: 'Traseira',
    },
    status: {
      connected: 'Conectado',
      disconnected: 'Desconectado',
      streaming: 'Transmitindo',
      loading: 'Carregando...',
      error: 'Erro',
    },
    safety: {
      missingPPE: 'EPI Faltando',
      dangerousProximity: 'Proximidade Perigosa',
      leak: 'Vazamento Detectado',
      spark: 'Faísca Detectada',
      exposedWire: 'Fio Exposto',
      slipperySurface: 'Superfície Escorregadia',
      openFlame: 'Chama Aberta',
    },
    actions: {
      runOCR: 'Executar OCR',
      syncOffline: 'Sincronizar Offline',
      startInspection: 'Iniciar Inspeção',
      endInspection: 'Encerrar Inspeção',
    },
    setup: {
      createTechnician: 'Criar Técnico',
      createSite: 'Criar Local',
      selectTechnician: 'Selecionar Técnico',
      selectSite: 'Selecionar Local',
      technicianName: 'Nome',
      technicianEmail: 'Email',
      siteName: 'Nome do Local',
      siteType: 'Tipo de Local',
      start: 'Iniciar',
    },
    ocr: {
      title: 'OCR de Equipamentos',
      uploadImage: 'Carregar Imagem',
      extractText: 'Extrair Texto',
      results: 'Resultados',
      serialNumbers: 'Números de Série',
      partCodes: 'Códigos de Peça',
      meterReadings: 'Leituras do Medidor',
      warningLabels: 'Rótulos de Aviso',
    },
    reports: {
      title: 'Relatórios de Inspeção',
      download: 'Baixar',
      view: 'Ver',
      noReports: 'Nenhum relatório disponível',
    },
    history: {
      title: 'Histórico de Inspeções',
      noHistory: 'Sem histórico',
      filterByDate: 'Filtrar por Data',
      filterBySite: 'Filtrar por Local',
    },
  },
  zh: {
    app: {
      title: 'FieldSight',
      subtitle: 'AI现场助手',
      version: 'v1.0.0',
      systemReady: '系统就绪',
      needHelp: '需要帮助?',
    },
    nav: {
      liveAssist: '实时协助',
      aiAssistant: 'AI助手',
      setup: '设置',
      ocr: 'OCR',
      reports: '报告',
      history: '历史',
    },
    live: {
      startCamera: '启动摄像头',
      stopCamera: '停止摄像头',
      pushToTalk: '按住说话',
      recording: '录制中...',
      snapshot: '快照',
      stop: '停止',
      switchCamera: '切换摄像头',
      selfie: '前置',
      back: '后置',
    },
    status: {
      connected: '已连接',
      disconnected: '已断开',
      streaming: '传输中',
      loading: '加载中...',
      error: '错误',
    },
    safety: {
      missingPPE: '缺少PPE',
      dangerousProximity: '危险接近',
      leak: '检测到泄漏',
      spark: '检测到火花',
      exposedWire: '外露电线',
      slipperySurface: '湿滑表面',
      openFlame: '明火',
    },
    actions: {
      runOCR: '运行OCR',
      syncOffline: '离线同步',
      startInspection: '开始检查',
      endInspection: '结束检查',
    },
    setup: {
      createTechnician: '创建技术员',
      createSite: '创建站点',
      selectTechnician: '选择技术员',
      selectSite: '选择站点',
      technicianName: '姓名',
      technicianEmail: '邮箱',
      siteName: '站点名称',
      siteType: '站点类型',
      start: '开始',
    },
    ocr: {
      title: '设备OCR',
      uploadImage: '上传图片',
      extractText: '提取文本',
      results: '结果',
      serialNumbers: '序列号',
      partCodes: '零件代码',
      meterReadings: '仪表读数',
      warningLabels: '警告标签',
    },
    reports: {
      title: '检查报告',
      download: '下载',
      view: '查看',
      noReports: '暂无报告',
    },
    history: {
      title: '检查历史',
      noHistory: '暂无历史',
      filterByDate: '按日期筛选',
      filterBySite: '按站点筛选',
    },
  },
  ja: {
    app: {
      title: 'FieldSight',
      subtitle: 'AIフィールドアシスタント',
      version: 'v1.0.0',
      systemReady: 'システム準備完了',
      needHelp: 'ヘルプが必要?',
    },
    nav: {
      liveAssist: 'ライブアシスタント',
      aiAssistant: 'AIアシスタント',
      setup: '設定',
      ocr: 'OCR',
      reports: 'レポート',
      history: '履歴',
    },
    live: {
      startCamera: 'カメラ開始',
      stopCamera: 'カメラ停止',
      pushToTalk: '押して話す',
      recording: '録画中...',
      snapshot: 'スナップショット',
      stop: '停止',
      switchCamera: 'カメラ切替',
      selfie: 'セルフィー',
      back: 'バック',
    },
    status: {
      connected: '接続済み',
      disconnected: '切断',
      streaming: 'ストリーミング',
      loading: '読み込み中...',
      error: 'エラー',
    },
    safety: {
      missingPPE: 'PPE着用なし',
      dangerousProximity: '危険な接近',
      leak: '漏洩検出',
      spark: '火花検出',
      exposedWire: '露出ワイヤー',
      slipperySurface: '滑りやすい表面',
      openFlame: ' открытое пламя',
    },
    actions: {
      runOCR: 'OCR実行',
      syncOffline: 'オフライン同期',
      startInspection: '検査開始',
      endInspection: '検査終了',
    },
    setup: {
      createTechnician: '技術員作成',
      createSite: 'サイト作成',
      selectTechnician: '技術員選択',
      selectSite: 'サイト選択',
      technicianName: '名前',
      technicianEmail: 'メール',
      siteName: 'サイト名',
      siteType: 'サイトタイプ',
      start: '開始',
    },
    ocr: {
      title: '機器OCR',
      uploadImage: '画像アップロード',
      extractText: 'テキスト抽出',
      results: '結果',
      serialNumbers: 'シリアル番号',
      partCodes: '部品コード',
      meterReadings: 'メーター読書',
      warningLabels: '警告ラベル',
    },
    reports: {
      title: '検査レポート',
      download: 'ダウンロード',
      view: '表示',
      noReports: 'レポートなし',
    },
    history: {
      title: '検査履歴',
      noHistory: '履歴なし',
      filterByDate: '日付でフィルタ',
      filterBySite: 'サイトでフィルタ',
    },
  },
  ko: {
    app: {
      title: 'FieldSight',
      subtitle: 'AI 필드 어시스턴트',
      version: 'v1.0.0',
      systemReady: '시스템 준비됨',
      needHelp: '도움이 필요하세요?',
    },
    nav: {
      liveAssist: '라이브 지원',
      aiAssistant: 'AI 어시스턴트',
      setup: '설정',
      ocr: 'OCR',
      reports: '보고서',
      history: '기록',
    },
    live: {
      startCamera: '카메라 시작',
      stopCamera: '카메라 중지',
      pushToTalk: '누르고 말하기',
      recording: '녹화 중...',
      snapshot: '스냅샷',
      stop: '중지',
      switchCamera: '카메라 전환',
      selfie: '셀피',
      back: '후면',
    },
    status: {
      connected: '연결됨',
      disconnected: '연결 끊김',
      streaming: '스트리밍',
      loading: '로딩 중...',
      error: '오류',
    },
    safety: {
      missingPPE: 'PPE 미착용',
      dangerousProximity: '위험한 근접',
      leak: '누출 감지',
      spark: '火花 감지',
      exposedWire: '노출된 와이어',
      slipperySurface: '미끄러운 표면',
      openFlame: ' открытое пламя',
    },
    actions: {
      runOCR: 'OCR 실행',
      syncOffline: '오프라인 동기화',
      startInspection: '검사 시작',
      endInspection: '검사 종료',
    },
    setup: {
      createTechnician: '기술자 생성',
      createSite: '사이트 생성',
      selectTechnician: '기술자 선택',
      selectSite: '사이트 선택',
      technicianName: '이름',
      technicianEmail: '이메일',
      siteName: '사이트 이름',
      siteType: '사이트 유형',
      start: '시작',
    },
    ocr: {
      title: '장비 OCR',
      uploadImage: '이미지 업로드',
      extractText: '텍스트 추출',
      results: '결과',
      serialNumbers: '일련번호',
      partCodes: '부품 코드',
      meterReadings: '계량기 판독값',
      warningLabels: '경고 라벨',
    },
    reports: {
      title: '검사 보고서',
      download: '다운로드',
      view: '보기',
      noReports: '보고서 없음',
    },
    history: {
      title: '검사 기록',
      noHistory: '기록 없음',
      filterByDate: '날짜별 필터',
      filterBySite: '사이트별 필터',
    },
  },
  ar: {
    app: {
      title: 'FieldSight',
      subtitle: 'مساعد المجال بالذكاء الاصطناعي',
      version: 'الإصدار 1.0.0',
      systemReady: 'النظام جاهز',
      needHelp: 'تحتاج مساعدة؟',
    },
    nav: {
      liveAssist: 'الدعم المباشر',
      aiAssistant: 'مساعد الذكاء الاصطناعي',
      setup: 'الإعداد',
      ocr: 'OCR',
      reports: 'التقارير',
      history: 'السجل',
    },
    live: {
      startCamera: 'بدء الكاميرا',
      stopCamera: 'إيقاف الكاميرا',
      pushToTalk: 'اضغط للتحدث',
      recording: 'جاري التسجيل...',
      snapshot: 'لقطة',
      stop: 'إيقاف',
      switchCamera: 'تبديل الكاميرا',
      selfie: 'سيلفي',
      back: 'خلفية',
    },
    status: {
      connected: 'متصل',
      disconnected: 'غير متصل',
      streaming: 'البث',
      loading: 'جاري التحميل...',
      error: 'خطأ',
    },
    safety: {
      missingPPE: 'معدات الحماية مفقودة',
      dangerousProximity: 'اقتراب خطير',
      leak: 'تسرب مكتشف',
      spark: 'شرارة مكتشفة',
      exposedWire: 'سلك مكشوف',
      slipperySurface: 'سطح زلق',
      openFlame: 'لهب مفتوح',
    },
    actions: {
      runOCR: 'تشغيل OCR',
      syncOffline: 'مزامنة غير متصلة',
      startInspection: 'بدء الفحص',
      endInspection: 'إنهاء الفحص',
    },
    setup: {
      createTechnician: 'إنشاء فني',
      createSite: 'إنشاء موقع',
      selectTechnician: 'اختر فني',
      selectSite: 'اختر موقع',
      technicianName: 'الاسم',
      technicianEmail: 'البريد الإلكتروني',
      siteName: 'اسم الموقع',
      siteType: 'نوع الموقع',
      start: 'بدء',
    },
    ocr: {
      title: 'OCR للمعدات',
      uploadImage: 'تحميل صورة',
      extractText: 'استخراج النص',
      results: 'النتائج',
      serialNumbers: 'الأرقام التسلسلية',
      partCodes: 'أكواد الأجزاء',
      meterReadings: 'قراءات العداد',
      warningLabels: 'علامات التحذير',
    },
    reports: {
      title: 'تقارير الفحص',
      download: 'تحميل',
      view: 'عرض',
      noReports: 'لا توجد تقارير',
    },
    history: {
      title: 'سجل الفحص',
      noHistory: 'لا يوجد سجل',
      filterByDate: 'تصفية حسب التاريخ',
      filterBySite: 'تصفية حسب الموقع',
    },
  },
  hi: {
    app: {
      title: 'FieldSight',
      subtitle: 'AI फील्ड सहायक',
      version: 'v1.0.0',
      systemReady: 'सिस्टम तैयार',
      needHelp: 'मदद चाहिए?',
    },
    nav: {
      liveAssist: 'लाइव सहायता',
      aiAssistant: 'AI सहायक',
      setup: 'सेटअप',
      ocr: 'OCR',
      reports: 'रिपोर्ट',
      history: 'इतिहास',
    },
    live: {
      startCamera: 'कैमरा शुरू करें',
      stopCamera: 'कैमरा बंद करें',
      pushToTalk: 'बोलने के लिए दबाएं',
      recording: 'रिकॉर्डिंग...',
      snapshot: 'स्नैपशॉट',
      stop: 'रुकें',
      switchCamera: 'कैमरा बदलें',
      selfie: 'सेल्फी',
      back: 'बैक',
    },
    status: {
      connected: 'कनेक्टेड',
      disconnected: 'डिस्कनेक्टेड',
      streaming: 'स्ट्रीमिंग',
      loading: 'लोड हो रहा है...',
      error: 'त्रुटि',
    },
    safety: {
      missingPPE: 'PPE गायब',
      dangerousProximity: 'खतरनाक निकटता',
      leak: 'रिसाव का पता चला',
      spark: 'चिंगारी का पता चला',
      exposedWire: 'एक्सपोज्ड वायर',
      slipperySurface: 'फिसलन सतह',
      openFlame: 'खुली आग',
    },
    actions: {
      runOCR: 'OCR चलाएं',
      syncOffline: 'ऑफलाइन सिंक',
      startInspection: 'निरीक्षण शुरू करें',
      endInspection: 'निरीक्षण समाप्त करें',
    },
    setup: {
      createTechnician: 'तकनीशियन बनाएं',
      createSite: 'साइट बनाएं',
      selectTechnician: 'तकनीशियन चुनें',
      selectSite: 'साइट चुनें',
      technicianName: 'नाम',
      technicianEmail: 'ईमेल',
      siteName: 'साइट का नाम',
      siteType: 'साइट प्रकार',
      start: 'शुरू करें',
    },
    ocr: {
      title: 'उपकरण OCR',
      uploadImage: 'छवि अपलोड करें',
      extractText: 'टेक्स्ट निकालें',
      results: 'परिणाम',
      serialNumbers: 'क्रम संख्या',
      partCodes: 'भाग कोड',
      meterReadings: 'मीटर रीडिंग',
      warningLabels: 'चेतावनी लेबल',
    },
    reports: {
      title: 'निरीक्षण रिपोर्ट',
      download: 'डाउनलोड',
      view: 'देखें',
      noReports: 'कोई रिपोर्ट नहीं',
    },
    history: {
      title: 'निरीक्षण इतिहास',
      noHistory: 'कोई इतिहास नहीं',
      filterByDate: 'तारीख से फ़िल्टर करें',
      filterBySite: 'साइट से फ़िल्टर करें',
    },
  },
}

export function getTranslations(lang: Language): Translation {
  return translations[lang] || translations.en
}

export function useTranslation(language: Language) {
  return getTranslations(language)
}
