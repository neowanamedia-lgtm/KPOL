/**
 * ApiProvider — 앱 전역에 단일 DataProvider 인스턴스를 주입.
 * App.tsx 루트에서 한 번 감싸고, 화면은 useDataProvider() 훅으로 접근.
 */

import React, { createContext, useContext, useMemo } from 'react';

import { activeConfig } from './config';
import { createDataProvider } from './index';
import type { DataProvider } from './types';

const DataProviderContext = createContext<DataProvider | null>(null);

interface Props {
  children: React.ReactNode;
  /** 테스트 등에서 다른 구현체를 주입할 때 사용 */
  override?: DataProvider;
}

export const ApiProvider: React.FC<Props> = ({ children, override }) => {
  const provider = useMemo<DataProvider>(
    () => override ?? createDataProvider(activeConfig),
    [override],
  );

  return (
    <DataProviderContext.Provider value={provider}>
      {children}
    </DataProviderContext.Provider>
  );
};

export const useDataProvider = (): DataProvider => {
  const ctx = useContext(DataProviderContext);
  if (!ctx) {
    throw new Error('useDataProvider must be used within <ApiProvider>');
  }
  return ctx;
};
