using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Data;
using System.Windows.Documents;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Shapes;
using MyControls;

namespace TagCreator
{
    /// <summary>
    /// Interaction logic for QuestionWindow.xaml
    /// </summary>
    public partial class QuestionWindow : WindowBase
    {
        private string _message;

        public QuestionWindow()
        {
            InitializeComponent();

            this.DataContext = this;
        }

        public string Message
        {
            get
            {
                return _message;
            }
            set
            {
                _message = value;
                NotifyPropertyChanged("Message");
            }
        }       

        private void _yesButton_Click(object sender, RoutedEventArgs e)
        {
            this.DialogResult = true;
        }

        
        
    }
}
