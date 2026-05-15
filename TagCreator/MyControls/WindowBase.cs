using System;
using System.Windows;
using System.Windows.Controls;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Threading;
using gTools.Log;
using System.Reflection;
using System.Windows.Media;
using System.ComponentModel;
using System.Windows.Input;

namespace MyControls
{
    public class WindowBase : Window, INotifyPropertyChanged
    {
        #region Initialization

        public event PropertyChangedEventHandler PropertyChanged;

        private const int WM_SETCURSOR = 0x20;
        private bool _isSetCursorHandled = true;

        public WindowBase()
        {             
        }

        static WindowBase()
        {
            DefaultStyleKeyProperty.OverrideMetadata(typeof(WindowBase), new FrameworkPropertyMetadata(typeof(WindowBase)));                                   
        }

        #endregion        

        #region Events

        protected override void OnSourceInitialized(EventArgs e)
        {
            base.OnSourceInitialized(e);

            System.Windows.Interop.HwndSource source = PresentationSource.FromVisual(this) as System.Windows.Interop.HwndSource;
            source.AddHook(WndProc);

            this.MaxWidth = SystemParameters.MaximizedPrimaryScreenWidth;
            this.MaxHeight = SystemParameters.MaximizedPrimaryScreenHeight;
        }

        protected IntPtr WndProc(IntPtr hWnd, int msg, IntPtr wParam, IntPtr lParam, ref bool handled)
        {
            if (msg == WM_SETCURSOR)
            {
                if (this._isSetCursorHandled)
                {
                    this.CaptureMouse();
                    this.ReleaseMouseCapture();
                    _isSetCursorHandled = false;
                }
                else
                    _isSetCursorHandled = true;
            }        

            return IntPtr.Zero;
        }        

        public override void OnApplyTemplate()
        {
            Button _minimizeButton = GetTemplateChild("_minimizeButton") as Button;
            if (_minimizeButton != null)
                _minimizeButton.Click += _minimizeButton_Click;

            Button _maximizeButton = GetTemplateChild("_maximizeButton") as Button;
            if (_maximizeButton != null)
                _maximizeButton.Click += _maximizeButton_Click;

            Button _closeButton = GetTemplateChild("_closeButton") as Button;
            if (_closeButton != null)
                _closeButton.Click += _closeButton_Click;
            
            base.OnApplyTemplate();
        }        

        void _closeButton_Click(object sender, RoutedEventArgs e)
        {
            this.Close();
        }

        void _maximizeButton_Click(object sender, RoutedEventArgs e)
        {
            if (this.WindowState == System.Windows.WindowState.Normal)
            {
                this.MaxWidth = SystemParameters.MaximizedPrimaryScreenWidth;
                this.MaxHeight = SystemParameters.MaximizedPrimaryScreenHeight;

                this.WindowState = System.Windows.WindowState.Maximized;
            }
            else
                this.WindowState = System.Windows.WindowState.Normal;

            this.InvalidateVisual();            
        }

        void _minimizeButton_Click(object sender, RoutedEventArgs e)
        {
            this.WindowState = System.Windows.WindowState.Minimized;
        }        

        #endregion

        #region Methods

        protected bool IsValid(DependencyObject obj)
        {
            return !Validation.GetHasError(obj) && LogicalTreeHelper.GetChildren(obj).OfType<DependencyObject>().All(IsValid);
        }
       
        protected string GetDataGridErrorDescription(DataGrid dataGrid)
        {
            string result = string.Empty;

            
            for (int i = 0; i < dataGrid.Items.Count; i++)
            {
                DataGridRow row = (DataGridRow)dataGrid.ItemContainerGenerator.ContainerFromIndex(i);
                if (Validation.GetErrors(row).Count == 0)
                    continue;

                result += Validation.GetErrors(row).Count.ToString();
            }           

            return result;
        }

        protected string GetErrorDescription(DependencyObject obj)
        {
            string result = string.Empty;
                              
            foreach (var error in Validation.GetErrors(obj))
                result += error.ErrorContent;

            for (int i = 0; i < VisualTreeHelper.GetChildrenCount(obj); i++)
            {
                DependencyObject o = VisualTreeHelper.GetChild(obj, i);

                string s = GetErrorDescription(o);
                if (s.Length > 0)
                {
                    result += s;
                    Console.WriteLine(o.ToString() + ": " + s);
                }
            }

            return result;
        }

        public void NotifyPropertyChanged(String property)
        {
            if (PropertyChanged != null)
            {
                PropertyChanged(this, new PropertyChangedEventArgs(property));
            }
        }        

        #endregion
    }
}
