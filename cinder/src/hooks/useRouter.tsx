import { useEffect, useState } from 'react'

const useRouter = () => {
    const views = ['start', 'discovery', 'create', 'holdings', 'token'];
    const [view, setView] = useState<string>('start');

    return { view, setView }
}

